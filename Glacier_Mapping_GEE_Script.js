/*
================================================================================
HKPM glacier inventory: mapping script for Google Earth Engine (Code Editor)
One run maps one epoch of the Landsat record.
================================================================================
Author : Mohammad Najim Nasimi, Chair of Hydrology and River Basin Management,
         Technical University of Munich
Paper  : HKPM-HM: a modular HBV-type hydrological model with a multi-decadal
         Landsat glacier inventory for Afghanistan
         (M. N. Nasimi, S. E. Boyce, P. Bauer-Gottwein, J. Huang, M. Disse)

Method
 1. Scenes: Landsat Collection 2 Level-2 surface reflectance (Landsat 5, 7, 8, 9)
    of 1 August to 30 September with a scene cloud cover below 60 %.
 2. Every scene is classified on its own: snow or ice where NDSI >= 0.4, after
    the quality mask (fill, dilated cloud, cirrus, cloud, cloud shadow).
 3. Clean ice: a pixel that is snow or ice in at least 75 % of its cloud-free
    observations of the epoch (persistence), with at least two observations,
    between 3,500 and 7,500 m, not permanent water (JRC Global Surface Water
    occurrence >= 50 %).  Persistence 50 % and 90 % give the upper and lower
    bound of the area.  This removes seasonal snow, which is present in only
    part of the observations.
 4. Debris-covered ice: the part of the RGI 7.0 glacier outlines that is not
    clean ice and has a slope of 25 degrees or less (Scherler et al., 2018;
    slope criterion after Paul et al., 2004).
 5. Export: polygons (shapefile) and a 90 m image with the area fraction of
    every class, of the boundary pixels and the number of clear observations.
    All areas, uncertainties and agreement scores of the paper are computed
    from this image with the script zonal.py.

How to use
   Set MID_YEAR, HALF and ASSET_ROOT in block 1 and press Run.  The console
   prints the number of scenes and the areas of a test region.  Start the
   export tasks in the Tasks tab.

Outputs (Tasks tab)
   Drive  HKPM_Glacier_Inventory/AFG_<epoch>_CleanIce   (shapefile)
   Drive  HKPM_Glacier_Inventory/AFG_<epoch>_Debris     (shapefile)
   Asset  <ASSET_ROOT>/inv90_<epoch>   (9 fraction bands x200, clear observations x5)
================================================================================
*/

// ----------------------------- 1. EDIT THIS ONLY -----------------------------
var MID_YEAR = 2002;          // mid-year of the epoch (1987, 1990, ..., 2023) or the single year (2025)
var HALF     = 1;             // 1 = three-year epoch (MID_YEAR-1 ... MID_YEAR+1), 0 = single year
var ASSET_ROOT = 'users/your_user_name/HKPM_inventory';   // your own asset folder for the 90 m image
var EXPORT_VECTORS = true;    // polygons to Drive
var EXPORT_RASTER  = true;    // 90 m fraction image to the asset folder
// ------------------------------------------------------------------------------

var MIN_GLACIER_ELEVATION = 3500, MAX_GLACIER_ELEVATION = 7500;   // m
var NDSI_THRESHOLD   = 0.4;     // snow or ice in a single scene
var PERSISTENCE      = 0.75;    // share of clear observations classified as snow or ice
var PERSISTENCE_LOW  = 0.50;    // upper bound of the area
var PERSISTENCE_HIGH = 0.90;    // lower bound of the area
var MIN_CLEAR_OBS    = 2;
var DOY_START = 213, DOY_END = 273;      // 1 August - 30 September
var MAX_SCENE_CLOUD = 60;                // %
var MIN_PX_CLEAN = 23;                   // 0.02 km2 at 30 m
var DEBRIS_MAX_SLOPE = 25;               // degrees
var WATER_OCCURRENCE = 50;               // %

// mapping rectangle: glacierised Afghanistan and the headwaters of the study catchments
var RECT = ee.Geometry.Rectangle([67.4, 34.2, 75.1, 38.55], null, false);
var rgiFC = ee.FeatureCollection('projects/sat-io/open-datasets/RGI/RGI_VECTOR_MERGED_V7').filterBounds(RECT);
var rgi  = ee.Image(0).byte().paint(rgiFC, 1);

var dem = ee.Image('USGS/SRTMGL1_003');
var slope = ee.Terrain.slope(dem);
var elevMask = dem.gte(MIN_GLACIER_ELEVATION).and(dem.lte(MAX_GLACIER_ELEVATION));
var water = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('occurrence').unmask(0).gte(WATER_OCCURRENCE);

// ----------------------------- 2. Landsat scenes ------------------------------
function ndsi(img, green, swir) {
  var clear = img.select('QA_PIXEL').bitwiseAnd(31).eq(0);   // no fill, dilated cloud, cirrus, cloud, cloud shadow
  var g = img.select(green).multiply(0.0000275).add(-0.2);
  var s = img.select(swir).multiply(0.0000275).add(-0.2);
  return g.subtract(s).divide(g.add(s)).rename('NDSI').updateMask(clear).updateMask(elevMask)
      .copyProperties(img, ['system:time_start']);
}
function l57(img) { return ndsi(img, 'SR_B2', 'SR_B5'); }
function l89(img) { return ndsi(img, 'SR_B3', 'SR_B6'); }
function scenes(id) {
  return ee.ImageCollection(id).filterBounds(RECT)
      .filterDate((MID_YEAR - HALF) + '-01-01', (MID_YEAR + HALF + 1) + '-01-01')
      .filter(ee.Filter.calendarRange(DOY_START, DOY_END, 'day_of_year'))
      .filter(ee.Filter.lt('CLOUD_COVER', MAX_SCENE_CLOUD));
}
var col;
if (MID_YEAR <= 1999)      col = scenes('LANDSAT/LT05/C02/T1_L2').map(l57);
else if (MID_YEAR <= 2011) col = scenes('LANDSAT/LT05/C02/T1_L2').map(l57).merge(scenes('LANDSAT/LE07/C02/T1_L2').map(l57));
else if (MID_YEAR <= 2012) col = scenes('LANDSAT/LE07/C02/T1_L2').map(l57);
else if (MID_YEAR <= 2021) col = scenes('LANDSAT/LC08/C02/T1_L2').map(l89);
else                       col = scenes('LANDSAT/LC08/C02/T1_L2').map(l89).merge(scenes('LANDSAT/LC09/C02/T1_L2').map(l89));
print('Scenes in the epoch:', col.size());

// ----------------------------- 3. Persistence ---------------------------------
// "NDSI >= t in at least a share q of the clear observations" is the same as
// "the (1-q) percentile of NDSI is >= t".
var pct = col.reduce(ee.Reducer.percentile([10, 25, 50]));
var nClear = col.count().unmask(0).rename('n');
var ok = nClear.gte(MIN_CLEAR_OBS).and(elevMask).and(water.not());

function finish(mask) {       // close one-pixel gaps, drop patches below the minimum mapping unit
  var f = mask.unmask(0).and(elevMask).focal_max(1, 'square', 'pixels').focal_min(1, 'square', 'pixels').gt(0);
  var big = f.selfMask().connectedPixelCount(MIN_PX_CLEAN + 1, true).gte(MIN_PX_CLEAN);
  return f.and(big.unmask(0));
}
function cleanAt(q) {
  var band = {0.9: 'NDSI_p10', 0.75: 'NDSI_p25', 0.5: 'NDSI_p50'}[q];
  // percentiles are rounded to two decimals, as in the product of the paper
  return finish(pct.select(band).multiply(100).round().unmask(-100).gte(NDSI_THRESHOLD * 100).and(ok));
}
var clean   = cleanAt(PERSISTENCE).rename('clean');
var cleanLo = cleanAt(PERSISTENCE_HIGH).rename('clean_lo');
var cleanHi = cleanAt(PERSISTENCE_LOW).rename('clean_hi');

// ----------------------------- 4. Debris-covered ice ---------------------------
var rgiNotClean = rgi.and(clean.not()).rename('rgi_notclean');
var debris = rgiNotClean.and(slope.lte(DEBRIS_MAX_SLOPE)).rename('debris');

// ----------------------------- 5. Numbers --------------------------------------
var px = ee.Image.pixelArea().divide(1e6);
function areaIn(mask, geom) {
  return ee.Number(mask.unmask(0).multiply(px).reduceRegion({reducer: ee.Reducer.sum(), geometry: geom,
      scale: 30, crs: 'EPSG:32642', maxPixels: 1e13, tileScale: 8}).values().get(0));
}
// (the console evaluation of the whole rectangle can time out; the exported image gives the same numbers)
var test = ee.Geometry.Rectangle([70.2, 35.4, 71.3, 37.0], null, false);
print('Test area (central Hindu Kush): clean ice km2', areaIn(clean, test), 'RGI 7.0 km2', areaIn(rgi, test),
      'overlap km2', areaIn(clean.and(rgi), test), 'debris-covered km2', areaIn(debris, test));

// ----------------------------- 6. Map ------------------------------------------
Map.centerObject(test, 9);
Map.addLayer(rgiFC.style({color: 'red', fillColor: '00000000', width: 1}), {}, 'RGI 7.0');
Map.addLayer(clean.selfMask(), {palette: ['#1f5a94']}, 'Clean ice (persistence 0.75)');
Map.addLayer(debris.selfMask(), {palette: ['#b5651d']}, 'Debris-covered ice');
Map.addLayer(cleanHi.and(clean.not()).selfMask(), {palette: ['#9ecae1']}, 'Only at persistence 0.50', false);

// ----------------------------- 7. Exports --------------------------------------
var label = HALF === 0 ? String(MID_YEAR) : (MID_YEAR - HALF) + '_' + (MID_YEAR + HALF);

if (EXPORT_RASTER) {
  var edge = clean.and(clean.focal_min(1, 'square', 'pixels').not()).rename('edge');   // boundary pixels (half-pixel uncertainty)
  var stack = ee.Image.cat([clean, cleanLo, cleanHi, debris, rgiNotClean,
      clean.and(rgi).rename('ov'), cleanLo.and(rgi).rename('ov_lo'), cleanHi.and(rgi).rename('ov_hi'), edge]);
  var toFrac = function(img, k) {      // mean of the 30 m cells in a 90 m cell
    return img.toFloat().reproject('EPSG:32642', null, 30).reduceResolution(ee.Reducer.mean(), true, 64)
        .reproject('EPSG:32642', null, 90).multiply(k).round();
  };
  var out = toFrac(stack, 200).toUint8().addBands(toFrac(nClear, 5).min(255).toUint8().rename('nobs_x5'))
      .set({epoch_mid: MID_YEAR, half: HALF, n_scenes: col.size(), scaling: 'fractions x200; nobs x5'});
  Export.image.toAsset({image: out, description: 'HKPM_inv90_' + label, assetId: ASSET_ROOT + '/inv90_' + label,
      region: RECT, scale: 90, crs: 'EPSG:32642', maxPixels: 1e10, pyramidingPolicy: {'.default': 'mean'}});
}

if (EXPORT_VECTORS) {
  var vec = function(mask, type) {
    return mask.selfMask().reduceToVectors({geometry: RECT, scale: 30, crs: 'EPSG:32642', geometryType: 'polygon',
        eightConnected: true, maxPixels: 1e13, tileScale: 8, labelProperty: 'cls'})
      .map(function(f) {
        var e = dem.reduceRegion({reducer: ee.Reducer.minMax().combine(ee.Reducer.mean(), '', true), geometry: f.geometry(), scale: 30, maxPixels: 1e9});
        return f.set({type: type, period: label, area_km2: f.geometry().area(1).divide(1e6),
                      min_elev: e.get('elevation_min'), max_elev: e.get('elevation_max'), mean_elev: e.get('elevation_mean'),
                      method: 'NDSI persistence >= ' + PERSISTENCE});
      });
  };
  Export.table.toDrive({collection: vec(clean, 'clean_ice'), description: 'AFG_' + label + '_CleanIce',
      folder: 'HKPM_Glacier_Inventory', fileNamePrefix: 'AFG_' + label + '_CleanIce', fileFormat: 'SHP'});
  Export.table.toDrive({collection: vec(debris, 'debris_covered'), description: 'AFG_' + label + '_Debris',
      folder: 'HKPM_Glacier_Inventory', fileNamePrefix: 'AFG_' + label + '_Debris', fileFormat: 'SHP'});
}
print('Export tasks for epoch ' + label + ' are listed in the Tasks tab.');
