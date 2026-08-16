# HKPM Glacier Inventory — Google Earth Engine Script

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

Calibrated Google Earth Engine (GEE) script for a **conservative
multi-temporal glacier inventory** (Landsat, 1986–2025), developed for the
Afghanistan Hindu Kush–Pamir and used to build the glacier forcing of the
[HKPM-HM hydrological model](https://github.com/mnajimnasimi/HKPM-HM).

The classifier maps **snow**, **clean ice**, and **debris-covered ice**
with a conservative rock-exclusion logic:

- Snow: NDSI > 0.5 **and** SWIR < 0.15 **and** Blue > 0.25 (must be bright)
- Clean ice: stricter thresholds plus rock-exclusion masks
  (rocks: SWIR > 0.18, NIR/SWIR < 1.3; very bright or very dark pixels
  are excluded)
- Debris-covered ice: thermal-band based (Landsat 8/9, i.e. from 2013
  onward)
- Larger minimum mapping units to suppress noise; morphological cleaning

## Contents

| File / folder | Purpose |
|---|---|
| `Glacier_Mapping_GEE_Script.js` | The Earth Engine script (paste into the GEE Code Editor) |
| `Study_Area_Boundary/` | **Required.** Boundary shapefile defining where the inventory is made (the Afghanistan glacier-belt boundary used in the paper) |
| `RGI_Reference_Glaciers/` | *Optional.* RGI-style reference inventory for visual comparison and a reference area total |
| `Afghanistan_Full_Boundary/` | *Optional.* Full national boundary, as a ready alternative study area |
| `docs/Glacier_Inventory_User_Guide_and_Workflow.pdf` | Full user guide and workflow (ESM 1 of the paper) |
| `docs/Scientific_Background.md` | Literature review and threshold justification for every classification rule |

## How to run

1. **Upload the study-area boundary as an Earth Engine asset**
   (GEE Code Editor → Assets → New → Shape files; upload all files of
   `Study_Area_Boundary/` together) and copy the resulting asset path.
2. Open `Glacier_Mapping_GEE_Script.js` in the Code Editor and set, near
   the top:
   ```js
   var STUDY_AREA_ASSET = '<your boundary asset path>';
   var PROCESS_YEAR     = 2025;   // any year; runs on a 3-year window
   ```
3. Click **Run**. Map layers and printed areas appear in the Console; use
   the **Tasks** tab to export the polygons and rasters to Google Drive.

To map a smaller or different region, simply upload another boundary and
point `STUDY_AREA_ASSET` at it — nothing else needs to change.

To overlay a reference inventory (e.g. RGI 7.0), upload
`RGI_Reference_Glaciers/` as an asset and set:

```js
var USE_RGI_REFERENCE = true;
var RGI_ASSET         = '<reference asset path>';
var RGI_AREA_FIELD    = 'area_km2';
```

## Notes

- Debris-covered ice is mapped only for years from 2013 onward (requires
  the Landsat 8/9 thermal band).
- The default inventory cadence is 3-yearly (2000, 2003, …, 2024); any
  individual year can also be mapped.
- Thresholds, indices, and validation are documented in
  `docs/Scientific_Background.md` and in the user guide.

## Citation

If you use this script or the resulting inventory, please cite the
accompanying paper (reference will be added upon publication) and this
repository:

> Nasimi, M. N. (2026). *HKPM Glacier Inventory — Google Earth Engine
> script* (Version 1.0.0) [Computer software].
> https://github.com/mnajimnasimi/HKPM-Glacier-Inventory-GEE

A machine-readable citation is provided in [`CITATION.cff`](CITATION.cff).

## License

Released under the [GNU General Public License v3.0](LICENSE).

## Contact

Mohammad Najim Nasimi
Chair of Hydrology and River Basin Management (Prof. Disse),
Technical University of Munich — najim.nasimi@tum.de
