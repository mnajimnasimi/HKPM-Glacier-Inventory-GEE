# HKPM Glacier Inventory — Google Earth Engine Script

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.21966643.svg)](https://doi.org/10.5281/zenodo.21966643)

Google Earth Engine (GEE) scripts for a **multi-temporal glacier inventory**
from the Landsat record (14 epochs, 1986–2025), developed for Afghanistan and
the adjoining headwaters of the Hindu Kush and Pamir, and used for the ice
areas of the glacier module of the
[HKPM-HM hydrological model](https://github.com/mnajimnasimi/HKPM-HM).

The method classifies every Landsat scene on its own and maps the part that
stays snow or ice through the late summers of an epoch:

- **Scenes**: Landsat 5, 7, 8 and 9, Collection 2 Level-2 surface reflectance,
  1 August to 30 September, scene cloud cover below 60 %.
- **Clean ice**: a pixel that is snow or ice (NDSI ≥ 0.4) in at least 75 % of
  its cloud-free observations of the epoch, with at least two observations,
  between 3,500 and 7,500 m, outside permanent water. Seasonal snow is
  present in only part of the observations and drops out.
- **Debris-covered ice**: the part of the RGI 7.0 glacier outlines that is not
  clean ice and has a slope of 25° or less.
- **Uncertainty**: persistence thresholds of 50 % and 90 % give the upper and
  lower bound of the clean-ice area; half a pixel on the outline gives the
  boundary uncertainty.

## Contents

| File / folder | Purpose |
|---|---|
| `Glacier_Mapping_GEE_Script.js` | The mapping script (paste into the GEE Code Editor); one run maps one epoch |
| `Inventory_Statistics_GEE_Script.js` | Exports the static image (RGI 7.0 share and elevation per 90 m cell) and prints the sums of an epoch for Afghanistan and for the mapping rectangle |
| `zonal_statistics/` | Python scripts for the areas per catchment and elevation band (`zonal.py`) and for the table per epoch (`make_epochs.py`) |
| `docs/Glacier_Inventory_User_Guide_and_Workflow.pdf` | User guide and workflow (ESM 1 of the paper) |
| `docs/Scientific_Background.md` | Background of the method and reasons for every setting |
| `Afghanistan_Full_Boundary/` | National boundary, used for the sums of Afghanistan |
| `RGI_Reference_Glaciers/` | *Optional.* RGI 7.0 outlines of Afghanistan as a shapefile, for comparison in a GIS |
| `Study_Area_Boundary/` | *Optional.* Polygon around the glacier belt of Afghanistan, for display or clipping in a GIS; the scripts do not need it |

## How to run

1. Open `Glacier_Mapping_GEE_Script.js` in the Code Editor and set, in block 1:
   ```js
   var MID_YEAR = 2002;          // mid-year of the epoch (1987, 1990, ..., 2023) or the single year (2025)
   var HALF     = 1;             // 1 = three-year epoch, 0 = single year
   var ASSET_ROOT = 'users/your_user_name/HKPM_inventory';   // your own asset folder
   ```
2. Click **Run**. The console prints the number of scenes and the areas of a
   test region; the map shows RGI 7.0, clean ice and debris-covered ice.
3. Start the export tasks in the **Tasks** tab: the polygons (shapefiles, to
   Google Drive) and a 90 m image with the area fraction of every class (to
   your asset folder).
4. For the areas per epoch, upload `Afghanistan_Full_Boundary/` as a table
   asset and run `Inventory_Statistics_GEE_Script.js` (static image once,
   sums for every epoch). Save the lines that it prints as
   `zonal_statistics/out/gee_national.csv` and run
   `zonal_statistics/make_epochs.py`.
5. For the areas per catchment and elevation band, download the static image
   and, for every epoch, the bands `clean`, `clean_lo`, `clean_hi`, `debris`,
   `edge`, `ov` and `nobs_x5` of the 90 m image as GeoTIFF to
   `zonal_statistics/dl/` (`static_90m.tif`, `inv90_<epoch>.tif`), put one
   polygon shapefile per catchment into `zonal_statistics/catchments/` and run
   `zonal_statistics/zonal.py` (Python with numpy, pandas, geopandas and
   rasterio). The user guide describes every step.

The mapping script needs no upload. RGI 7.0 is read from the public Earth
Engine community catalogue, the elevation from SRTM, permanent water from the
JRC Global Surface Water layer. The mapping rectangle (67.4–75.1° E,
34.2–38.55° N) is set in the script and can be changed there.

## Notes

- The debris-covered class depends on the RGI 7.0 outlines, which date from
  about 2000. Ice that has disappeared at a glacier terminus since then is
  still counted, and debris-covered ice outside the outlines is missed.
- A persistence threshold cannot separate perennial snow from glacier ice.
- The epochs before 1998 have few scenes and cover the glaciers only in part.
- All settings and their reasons are given in `docs/Scientific_Background.md`
  and in the user guide. The areas of the inventory and their uncertainty are
  reported in the accompanying paper.

## Citation

If you use this script or the resulting inventory, please cite the
accompanying paper (reference will be added upon publication) and this
repository:

> Nasimi, M. N. (2026). *HKPM Glacier Inventory — Google Earth Engine
> script* (Version 1.0.1) [Computer software].
> https://github.com/mnajimnasimi/HKPM-Glacier-Inventory-GEE, https://doi.org/10.5281/zenodo.21966643

A machine-readable citation is provided in [`CITATION.cff`](CITATION.cff).

## License

Released under the [GNU General Public License v3.0](LICENSE).

## Contact

Mohammad Najim Nasimi
Chair of Hydrology and River Basin Management (Prof. Disse),
Technical University of Munich — najim.nasimi@tum.de
