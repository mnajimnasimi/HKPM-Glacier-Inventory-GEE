/*
================================================================================
HKPM glacier inventory: statistics script for Google Earth Engine (Code Editor)
Run it after Glacier_Mapping_GEE_Script.js has exported the 90 m image of an epoch.
================================================================================
Author : Mohammad Najim Nasimi, Chair of Hydrology and River Basin Management,
         Technical University of Munich
Paper  : HKPM-HM: a modular HBV-type hydrological model with a multi-decadal
         Landsat glacier inventory for Afghanistan
         (M. N. Nasimi, S. E. Boyce, P. Bauer-Gottwein, J. Huang, M. Disse)

What it does
 1. Static image (once): share of every 90 m cell that lies inside the RGI 7.0
    outlines (x200) and the mean SRTM elevation of the cell, on the grid of the
    inventory images.  The script zonal.py needs it for the statistics per
    catchment and per elevation band.
 2. Sums of one epoch over Afghanistan and over the mapping rectangle (km2).
    The console prints one line in the column order of gee_national.csv; the
    script make_epochs.py turns that table into inventory_epochs.csv.

Accounting (the same as in zonal.py)
   A cell counts as observed if it has two or more clear observations on
   average (band nobs_x5 >= 10).  Debris-covered ice is counted in observed
   cells only.  rgiobs is the RGI 7.0 area in observed cells; the rest of the
   RGI area is glacier ice without a clear observation.  nobsw is the number of
   clear observations weighted by the clean-ice area.

How to use
   Upload the national boundary (folder Afghanistan_Full_Boundary of the
   repository) as a table asset, set the four variables of block 1 and press Run.
================================================================================
*/

// ----------------------------- 1. EDIT THIS ONLY -----------------------------
var ASSET_ROOT = 'users/your_user_name/HKPM_inventory';             // folder with the images inv90_<epoch>
var AFG_ASSET  = 'users/your_user_name/Afghanistan_union';          // national boundary (table asset)
var MID_YEAR = 2002;          // mid-year of the epoch (1987, 1990, ..., 2023) or the single year (2025)
var HALF     = 1;             // 1 = three-year epoch, 0 = single year
var EXPORT_STATIC = false;    // true: start the export of the static image (needed once)
// ------------------------------------------------------------------------------

var RECT = ee.Geometry.Rectangle([67.4, 34.2, 75.1, 38.55], null, false);
var label = HALF === 0 ? String(MID_YEAR) : (MID_YEAR - HALF) + '_' + (MID_YEAR + HALF);

// ----------------------------- 2. Static image --------------------------------
var rgiFC = ee.FeatureCollection('projects/sat-io/open-datasets/RGI/RGI_VECTOR_MERGED_V7').filterBounds(RECT);
var rgi30 = ee.Image(0).byte().paint(rgiFC, 1);
var dem = ee.Image('USGS/SRTMGL1_003');
function to90(img) {          // mean of the 30 m cells in a 90 m cell
  return img.toFloat().reproject('EPSG:32642', null, 30).reduceResolution(ee.Reducer.mean(), true, 64)
      .reproject('EPSG:32642', null, 90);
}
var staticImg = to90(rgi30).multiply(200).round().toInt16().rename('rgi_x200')
    .addBands(to90(dem).round().toInt16().rename('elevation'));
if (EXPORT_STATIC) {
  Export.image.toAsset({image: staticImg, description: 'HKPM_static_90m', assetId: ASSET_ROOT + '/static_90m',
      region: RECT, scale: 90, crs: 'EPSG:32642', maxPixels: 1e10, pyramidingPolicy: {'.default': 'mean'}});
  print('Export task of the static image is listed in the Tasks tab.');
}

// ----------------------------- 3. Sums of one epoch ---------------------------
var img = ee.Image(ASSET_ROOT + '/inv90_' + label);
var km2 = ee.Image.pixelArea().divide(1e6);
var observed = img.select('nobs_x5').gte(10);
function frac(band) { return img.select(band).divide(200); }
var rgi = staticImg.select('rgi_x200').divide(200);
var stack = ee.Image.cat([
  frac('clean').rename('clean'), frac('clean_lo').rename('clean_lo'), frac('clean_hi').rename('clean_hi'),
  frac('debris').multiply(observed).rename('debris'), frac('edge').rename('edge'), frac('ov').rename('ov'),
  img.select('nobs_x5').divide(5).multiply(frac('clean')).rename('nobsw'),
  rgi.rename('rgi7'), rgi.multiply(observed).rename('rgiobs')]).multiply(km2);
var ORDER = ['clean', 'clean_lo', 'clean_hi', 'debris', 'edge', 'ov', 'nobsw', 'rgi7', 'rgiobs'];

function sums(geometry) {
  var d = stack.reduceRegion({reducer: ee.Reducer.sum(), geometry: geometry, scale: 90, crs: 'EPSG:32642',
      maxPixels: 1e10, tileScale: 4});
  return ee.List(ORDER).map(function(k) { return ee.Number(d.get(k)).format('%.1f'); });
}
var afg = ee.FeatureCollection(AFG_ASSET).geometry();
var line = ee.List([label, ee.Number(img.get('n_scenes')).format('%d')]).cat(sums(afg)).cat(sums(RECT)).join(',');
print('epoch,n_scenes,afg_' + ORDER.join(',afg_') + ',rect_' + ORDER.join(',rect_'));
print(line);

Map.centerObject(RECT, 6);
Map.addLayer(img.select('clean').selfMask(), {min: 0, max: 200, palette: ['#c6dbef', '#1f5a94']}, 'Clean ice fraction (x200), ' + label);
Map.addLayer(img.select('debris').selfMask(), {min: 0, max: 200, palette: ['#f0d9b5', '#b5651d']}, 'Debris-covered ice fraction (x200)', false);
