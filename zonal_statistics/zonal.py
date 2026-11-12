"""
Zonal statistics of the glacier inventory.

Input : dl/inv90_<epoch>.tif   90 m image of an epoch from Glacier_Mapping_GEE_Script.js, downloaded as GeoTIFF with the seven bands
                               clean, clean_lo, clean_hi, debris, edge, ov, nobs_x5 in this order (area fractions x200, observations x5)
        dl/static_90m.tif      static image from Inventory_Statistics_GEE_Script.js (RGI 7.0 fraction x200, mean SRTM elevation)
        A file can also be given as 16 tiles dl/<name>_t<k>.tif, which are merged on their common grid.
        catchments/<name>.shp  one polygon shapefile per catchment (any projection)
        ../Afghanistan_Full_Boundary/Afghanistan_union.shp   national boundary
Output: out/inventory_epochs.csv        area per epoch for the mapping rectangle and for Afghanistan, with bounds
        out/inventory_catchments.csv    area per epoch and catchment
        out/glacier_hypsometry_by_epoch.csv   area per epoch, catchment, ice type and 100 m elevation band (model input)
        out/inventory_epochs_local.csv  the same sums as inventory_epochs.csv, computed on the grid (check of make_epochs.py)
"""
import numpy as np, pandas as pd, geopandas as gpd, rasterio, glob, os, sys
from rasterio.features import rasterize
HERE = os.path.dirname(os.path.abspath(__file__))
DL = os.path.join(HERE, 'dl'); OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
CAT = os.environ.get('CATCHMENTS', os.path.join(HERE, 'catchments'))            # one polygon shapefile per catchment: <name>.shp
AFG = os.environ.get('AFG_BOUNDARY', os.path.join(HERE, '..', 'Afghanistan_Full_Boundary', 'Afghanistan_union.shp'))
EPOCHS = ['1986_1988','1989_1991','1992_1994','1995_1997','1998_2000','2001_2003','2004_2006','2007_2009','2010_2012',
          '2013_2015','2016_2018','2019_2021','2022_2024','2025']
BANDS = ['clean','clean_lo','clean_hi','debris','edge','ov','nobs_x5']      # bands of the downloaded rasters
def mid(e): return int(e) if '_' not in e else int(e[:4]) + 1

def mosaic(name):
    """Merge the 16 tiles of one image on their common 90 m grid (cached as <name>.tif)."""
    out = os.path.join(DL, name + '.tif')
    if os.path.exists(out): return out
    from rasterio.merge import merge
    fs = sorted(glob.glob(os.path.join(DL, name + '_t*.tif')))
    if len(fs) < 16: return None
    srcs = [rasterio.open(f) for f in fs]
    arr, tr = merge(srcs, method='max', nodata=None)
    if arr.dtype.kind == 'i': arr[arr < 0] = 0          # masked cells of the export
    prof = srcs[0].profile; prof.update(height=arr.shape[1], width=arr.shape[2], transform=tr, compress='deflate', tiled=True, BIGTIFF='IF_SAFER')
    with rasterio.open(out, 'w', **prof) as dst: dst.write(arr)
    [s_.close() for s_ in srcs]
    return out

def zones(src):
    """Catchments and Afghanistan as (window, mask) on the mosaic grid; nested catchments are handled one by one."""
    from rasterio.windows import from_bounds, Window
    shp = {}
    for f in sorted(glob.glob(os.path.join(CAT, '*.shp'))): shp[os.path.splitext(os.path.basename(f))[0]] = gpd.read_file(f).to_crs(src.crs)
    shp['__AFG__'] = gpd.read_file(AFG).to_crs(src.crs)
    out = {}
    for n, g in shp.items():
        b = g.total_bounds
        if b[0] >= src.bounds.right or b[2] <= src.bounds.left or b[1] >= src.bounds.top or b[3] <= src.bounds.bottom: continue
        w = from_bounds(max(b[0], src.bounds.left), max(b[1], src.bounds.bottom), min(b[2], src.bounds.right), min(b[3], src.bounds.top), src.transform)
        r0, c0 = max(int(np.floor(w.row_off)), 0), max(int(np.floor(w.col_off)), 0)
        r1, c1 = min(int(np.ceil(w.row_off + w.height)), src.height), min(int(np.ceil(w.col_off + w.width)), src.width)
        if r1 <= r0 or c1 <= c0: continue
        win = Window(c0, r0, c1 - c0, r1 - r0)
        m = rasterize([(geom, 1) for geom in g.geometry], out_shape=(r1 - r0, c1 - c0), transform=src.window_transform(win), fill=0, dtype='uint8').astype(bool)
        out[n] = (slice(r0, r1), slice(c0, c1), m)
    # the mapping rectangle is defined in geographic coordinates (67.4-75.1 E, 34.2-38.55 N)
    from shapely.geometry import Polygon
    xs = np.linspace(67.4, 75.1, 200); ys = np.linspace(34.2, 38.55, 120)
    ring = [(x, 34.2) for x in xs] + [(75.1, y) for y in ys] + [(x, 38.55) for x in xs[::-1]] + [(67.4, y) for y in ys[::-1]]
    rect = gpd.GeoSeries([Polygon(ring)], crs='EPSG:4326').to_crs(src.crs)
    m = rasterize([(rect.iloc[0], 1)], out_shape=(src.height, src.width), transform=src.transform, fill=0, dtype='uint8').astype(bool)
    out['__RECT__'] = (slice(0, src.height), slice(0, src.width), m)
    return out

def run():
    ep_rows, hyp = {}, {}
    with rasterio.open(mosaic('static_90m')) as s:
        rgi = s.read(1).astype(np.float32)/200.0; dem = s.read(2).astype(np.float32); px = abs(s.res[0]*s.res[1])/1e6
        Z = zones(s)
    band = (np.floor(dem/100.0)*100 + 50).astype(np.int32)
    for e in EPOCHS:
        f = mosaic(f'inv90_{e}')
        if f is None: continue
        with rasterio.open(f) as r: a = r.read()
        d = {b: a[i] for i, b in enumerate(BANDS)}                       # uint8, fractions x200 (nobs x5)
        # observation mask at 90 m: at least two clear observations on average over the 30 m pixels of the cell.
        # Debris-covered ice is counted only where the cell was observed; RGI ice in cells that were not observed
        # (mostly bright accumulation areas flagged as cloud) is kept as a class of its own, 'rgi_unobs'.
        obsm = d['nobs_x5'] >= 10
        d['debris'] = np.where(obsm, d['debris'], 0).astype(np.uint8)
        d['rgi_unobs'] = np.where(obsm, 0, np.round(rgi*200)).astype(np.uint8)
        d['rgi_obs'] = np.where(obsm, np.round(rgi*200), 0).astype(np.uint8)
        for zn, (rs, cs, m) in Z.items():
            sel = (lambda x: x[rs, cs]) if m is None else (lambda x: x[rs, cs][m])
            acc = ep_rows.setdefault((e, zn), {})
            cl = sel(d['clean']).astype(np.float64)/200.0
            for b_ in BANDS[:-1] + ['rgi_unobs', 'rgi_obs']: acc[b_] = float(sel(d[b_]).sum(dtype=np.float64))/200.0*px
            acc['rgi7'] = float(sel(rgi).sum(dtype=np.float64))*px
            acc['nobs_w'] = float((sel(d['nobs_x5'])/5.0*cl).sum())*px
            if not zn.startswith('__'):
                bz = sel(band)
                for typ in ['clean','debris','clean_lo','clean_hi','rgi_unobs']:
                    v = sel(d[typ]).astype(np.float64)/200.0
                    s_ = pd.Series(v).groupby(bz).sum()*px
                    for z_, v_ in s_[s_ > 0].items(): hyp[(zn, e, typ, int(z_))] = float(v_)
        print('epoch', e, 'done', flush=True)
    rows = []
    for (e, zn), a in ep_rows.items():
        r = dict(epoch=e, mid_year=mid(e), zone={'__RECT__':'Mapping rectangle','__AFG__':'Afghanistan'}.get(zn, zn))
        r.update(clean_km2=a['clean'], clean_lo_km2=a['clean_lo'], clean_hi_km2=a['clean_hi'], debris_km2=a['debris'], rgi_unobs_km2=a['rgi_unobs'],
                 coverage_pct=100*a['rgi_obs']/a['rgi7'] if a['rgi7'] > 0 else np.nan,
                 edge_unc_km2=0.5*a['edge'], rgi7_km2=a['rgi7'], overlap_km2=a['ov'],
                 mean_clear_obs=a['nobs_w']/a['clean'] if a['clean'] > 0 else np.nan)
        # agreement with RGI 7.0, evaluated where the epoch has observations (reference = observed part of the RGI area)
        A, O, Rg = a['clean'], a['ov'], a['rgi_obs']
        if A > 0 and Rg > 0:
            r['recall'] = O/Rg; r['precision'] = O/A; r['IoU'] = O/(A + Rg - O); r['F1'] = 2*O/(A + Rg)
            tot = A + a['debris']; ot = O + a['debris']                     # debris lies inside the RGI outline by construction
            r['recall_total'] = ot/Rg; r['precision_total'] = ot/tot; r['IoU_total'] = ot/(tot + Rg - ot); r['F1_total'] = 2*ot/(tot + Rg)
        r['total_km2'] = a['clean'] + a['debris'] + a['rgi_unobs']
        rows.append(r)
    df = pd.DataFrame(rows).sort_values(['zone','mid_year'])
    df[df.zone.isin(['Mapping rectangle','Afghanistan'])].to_csv(os.path.join(OUT, 'inventory_epochs_local.csv'), index=False)      # check of make_epochs.py
    df[~df.zone.isin(['Mapping rectangle','Afghanistan'])].to_csv(os.path.join(OUT, 'inventory_catchments.csv'), index=False)
    h = pd.DataFrame([dict(catchment=k[0], epoch=k[1].replace('_','-'), mid_year=mid(k[1]), type=k[2], band_center_m=k[3], area_km2=round(v, 5)) for k, v in hyp.items()])
    if len(h): h.sort_values(['catchment','mid_year','type','band_center_m']).to_csv(os.path.join(OUT, 'glacier_hypsometry_by_epoch.csv'), index=False)
    return df

if __name__ == '__main__':
    df = run()
    pd.set_option('display.width', 250); pd.set_option('display.max_columns', 30)
    print(df[df.zone.isin(['Mapping rectangle','Afghanistan'])][['zone','epoch','clean_km2','clean_lo_km2','clean_hi_km2','debris_km2','edge_unc_km2','rgi7_km2','recall','precision','IoU','IoU_total','mean_clear_obs']].round(2).to_string())
