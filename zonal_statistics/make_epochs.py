"""Per-epoch table of the inventory for Afghanistan and for the mapping rectangle (Table 1, Figure 3).
Input : out/gee_national.csv = sums of the 90 m fraction bands, computed in Earth Engine with reduceRegion on the stored
        rasters (areas in km2).  debris = debris-covered ice in cells with observations; rgiobs = RGI 7.0 area in cells with
        at least two clear observations; nobsw = clear observations weighted by clean-ice area.  Same accounting as zonal.py.
Output: out/inventory_epochs.csv"""
import pandas as pd, numpy as np, os
H = os.path.dirname(os.path.abspath(__file__)); g = pd.read_csv(os.path.join(H, 'out', 'gee_national.csv'))
COMPLETE = 90.0            # an epoch counts as complete if at least 90 % of the RGI ice area has two or more clear observations
rows = []
for _, r in g.iterrows():
    for z, lab in [('afg', 'Afghanistan'), ('rect', 'Mapping rectangle')]:
        c, lo, hi, d, e, ov, nw, rg, ro = [r[f'{z}_{k}'] for k in ['clean','clean_lo','clean_hi','debris','edge','ov','nobsw','rgi7','rgiobs']]
        ep = str(r['epoch']); mid = int(ep) if '_' not in ep else int(ep[:4]) + 1
        un = rg - ro; tot = c + d + un; ot = ov + d; t2 = c + d
        rows.append(dict(zone=lab, epoch=ep, mid_year=mid, n_scenes=int(r['n_scenes']), coverage_pct=100*ro/rg, complete=bool(100*ro/rg >= COMPLETE),
                         clean_km2=c, clean_lo_km2=lo, clean_hi_km2=hi, debris_km2=d, rgi_unobs_km2=un, total_km2=tot,
                         debris_share_pct=100*d/tot, edge_unc_km2=0.5*e, edge_unc_pct=50*e/c, rgi7_km2=rg, rgi_obs_km2=ro, overlap_km2=ov,
                         recall=ov/ro, precision=ov/c, IoU=ov/(c + ro - ov), F1=2*ov/(c + ro),
                         recall_total=ot/ro, precision_total=ot/t2, IoU_total=ot/(t2 + ro - ot), F1_total=2*ot/(t2 + ro), mean_clear_obs=nw/c))
df = pd.DataFrame(rows).sort_values(['zone', 'mid_year']); df.to_csv(os.path.join(H, 'out', 'inventory_epochs.csv'), index=False)
pd.set_option('display.width', 250)
print(df[df.zone == 'Afghanistan'][['epoch','n_scenes','coverage_pct','clean_km2','clean_lo_km2','clean_hi_km2','debris_km2','rgi_unobs_km2','total_km2','edge_unc_pct','recall','precision','IoU','IoU_total','mean_clear_obs']].round(2).to_string())
