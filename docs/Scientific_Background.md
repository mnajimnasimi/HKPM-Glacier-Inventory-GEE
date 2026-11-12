# Scientific background of the mapping method

This document gives the reasons for the settings of
`Glacier_Mapping_GEE_Script.js`. The user guide in this folder describes the
workflow step by step; the accompanying paper reports the results.

## 1. Aim and region

The inventory supplies a hydrological model with the ice area of each
catchment, by elevation band and ice type, for the years of the discharge
records, and it documents how the mapped ice area of Afghanistan changed
between 1986 and 2025. The mapping rectangle (67.4–75.1° E, 34.2–38.55° N)
contains the glacierised part of Afghanistan and the headwaters of the study
catchments in Pakistan and Tajikistan. It is mapped in 13 three-year epochs,
from 1986–1988 to 2022–2024, and for the single year 2025.

## 2. Why every scene is classified and the persistent part is mapped

Snow and ice reflect strongly in the visible and absorb in the shortwave
infrared. The Normalised Difference Snow Index,
NDSI = (Green − SWIR1) / (Green + SWIR1), uses this contrast (Dozier, 1989;
Hall et al., 1995). The index does not tell glacier ice from snow. A single
image, or a composite of the images of an epoch, therefore maps glacier ice
together with the snow that lies at the time of the images.

A test showed the size of this effect. Median composites of the scenes
between 15 August and 31 October retain seasonal snow: a median of
reflectances from snow-covered and snow-free dates is still bright enough to
pass the snow and ice rules, and October scenes add fresh snow. For the epoch
2001–2003 the area mapped in this way in eight glacierised study catchments
exceeded the RGI 7.0 area by about one half.

The inventory is therefore built on the principle of persistence, which is
used for mapping perennial snow and ice from image time series (Selkowitz and
Forster, 2016; Winsvold et al., 2016). Every scene is classified separately,
and a pixel counts as glacier only if it is classified as snow or ice in most
of its cloud-free observations. Late-summer snowfall and snow that outlasts
one cool summer are present in only part of the observations of a three-year
epoch and are removed by this rule, whereas glacier ice and the perennial
snow of the accumulation areas are present in nearly all of them. Clean ice
in this sense includes the snow-covered accumulation areas; it excludes ice
under debris.

## 3. Settings

| Setting | Value | Reason |
|---|---|---|
| Sensors | Landsat 5 TM, 7 ETM+, 8 and 9 OLI, Collection 2 Level-2 surface reflectance | One consistent record from 1986 to 2025 (Wulder et al., 2019, 2022) |
| Season | 1 August to 30 September | End of the ablation season, least seasonal snow; October scenes add fresh snow |
| Scene cloud cover | below 60 % | Keeps partly cloudy scenes, whose clear parts add observations; clouds are removed per pixel |
| Pixel quality mask | fill, dilated cloud, cirrus, cloud and cloud shadow removed (QA_PIXEL) | Standard mask of Collection 2 |
| Snow or ice in a scene | NDSI ≥ 0.4 | Threshold recommended by Hall et al. (1995) and common in glacier mapping (Paul et al., 2013) |
| Persistence | 0.75 of the cloud-free observations | Fixed after a comparison with RGI 7.0 in three test areas (Wakhan, central Hindu Kush, Chitral headwaters) |
| Bounds | 0.5 (upper) and 0.9 (lower) | Carried along as the classification range of every area |
| Minimum number of cloud-free observations | 2 | A single observation cannot show persistence |
| Elevation | 3,500 to 7,500 m (SRTM) | Range of glacier ice in the region |
| Permanent water | removed where the water occurrence is 50 % or more (Global Surface Water; Pekel et al., 2016) | Lakes have a high NDSI |
| Minimum mapping unit | 0.02 km² (23 pixels) | Small isolated areas are removed (Paul et al., 2013) |
| Gap closing | one pixel | Closes single-pixel holes without moving the outline |

In Earth Engine the persistence rule is evaluated with percentiles: the NDSI
is at or above the threshold in at least a share q of the observations if
the (1 − q) percentile of the NDSI is at or above the threshold. The script
therefore reduces the NDSI stack of an epoch to its 10th, 25th and 50th
percentile.

## 4. Uncertainty

Three sources are quantified for every epoch.

- **Position of the outline.** Following Granshaw and Fountain (2006) and
  Paul et al. (2017), the outline is assumed to be uncertain by half a pixel,
  so that the area uncertainty is half the area of the boundary pixels. The
  value is large in this region, because it has many small glaciers.
- **Classification.** The areas at persistence 0.5 and 0.9 bound the area at
  0.75. The range is asymmetric, because a lower fraction lets perennial snow
  in.
- **Number of observations.** The number of cloud-free observations per pixel
  rises strongly from the first to the last epoch. An epoch is called
  complete if at least 90 % of the RGI ice area has two or more cloud-free
  observations; the areas of the incomplete early epochs refer to the
  observed part.

The series records perennial snow as well as glacier ice, and a difference
between two neighbouring epochs should not be read as a change of glacier
area. The inventory has not been compared with outlines digitised by hand
from high-resolution images.

## 5. Debris-covered ice

Debris-covered ice cannot be separated from the surrounding rock by its
reflectance. The inventory follows Scherler et al. (2018) and defines it with
the help of existing glacier outlines, as the part of a glacier that is not
clean ice: a pixel is mapped as debris-covered ice if it lies inside an
outline of RGI 7.0, is not clean ice in the epoch concerned, and has a
surface slope of 25° or less, a criterion that separates debris-covered
tongues from the rock walls inside the outlines (Paul et al., 2004).

The definition has two consequences. The RGI outlines of the region date from
1994 to 2008, most of them from 2001 and 2002. Ice that has disappeared at a
glacier terminus since then is still counted as debris-covered ice, and
debris-covered ice outside the outlines is missed, so that the debris-covered
area of the recent epochs is an upper estimate. And because the outline is
fixed, a change in the debris-covered area reflects a change in the clean ice
inside the outline, not a mapped change of the glacier margin.

A fully automatic classification of debris-covered ice from thermal and
spectral indices, in the manner of Shokory and Lane (2023), was also tested.
In our implementation it selected warm, gently sloping ground of any kind,
and it was not pursued.

## 6. Evaluation against RGI 7.0

Nearly all RGI 7.0 outlines of the region date from 2001 and 2002 (RGI
Consortium, 2023), so the epoch 2001–2003 can be compared with them cell by
cell. Recall, precision, intersection over union and F1 score are computed
for clean ice, and for clean and debris-covered ice together, against the RGI
area in the cells that have observations (`zonal_statistics/zonal.py`). The
paper reports the scores.

The comparison is a test of consistency with the accepted reference and not a
validation against ground truth. The RGI outlines of this region were
themselves derived from Landsat scenes (Nuimura et al., 2015), they include
debris-covered ice, and for the debris-covered class they are an input of the
method.

## 7. Exported products

- Polygons of clean ice and of debris-covered ice per epoch (shapefiles) with
  area and minimum, mean and maximum elevation.
- A 90 m image per epoch with, for every cell, the share of clean ice (at the
  three persistence fractions), of debris-covered ice, of the overlap with
  RGI 7.0 and of boundary pixels (scaled by 200), and the mean number of
  cloud-free observations (scaled by 5). The areas, their uncertainty and the
  agreement scores are sums of these fractions
  (`zonal_statistics/zonal.py`).

## References

- Dozier, J., 1989. Spectral signature of alpine snow cover from the Landsat Thematic Mapper. Remote Sensing of Environment 28, 9–22. https://doi.org/10.1016/0034-4257(89)90101-6
- Granshaw, F. D., Fountain, A. G., 2006. Glacier change (1958–1998) in the North Cascades National Park Complex, Washington, USA. Journal of Glaciology 52 (177), 251–256. https://doi.org/10.3189/172756506781828782
- Hall, D. K., Riggs, G. A., Salomonson, V. V., 1995. Development of methods for mapping global snow cover using moderate resolution imaging spectroradiometer data. Remote Sensing of Environment 54, 127–140. https://doi.org/10.1016/0034-4257(95)00137-P
- Nuimura, T., Sakai, A., Taniguchi, K., Nagai, H., Lamsal, D., Tsutaki, S., Kozawa, A., Hoshina, Y., Takenaka, S., Omiya, S., Tsunematsu, K., Tshering, P., Fujita, K., 2015. The GAMDAM glacier inventory: a quality-controlled inventory of Asian glaciers. The Cryosphere 9 (3), 849–864. https://doi.org/10.5194/tc-9-849-2015
- Paul, F., Huggel, C., Kääb, A., 2004. Combining satellite multispectral image data and a digital elevation model for mapping debris-covered glaciers. Remote Sensing of Environment 89 (4), 510–518. https://doi.org/10.1016/j.rse.2003.11.007
- Paul, F., Barrand, N. E., Baumann, S., Berthier, E., Bolch, T., Casey, K., Frey, H., Joshi, S. P., Konovalov, V., Le Bris, R., Mölg, N., Nosenko, G., Nuth, C., Pope, A., Racoviteanu, A., Rastner, P., Raup, B., Scharrer, K., Steffen, S., Winsvold, S., 2013. On the accuracy of glacier outlines derived from remote-sensing data. Annals of Glaciology 54 (63), 171–182. https://doi.org/10.3189/2013AoG63A296
- Paul, F., Bolch, T., Briggs, K., Kääb, A., McMillan, M., McNabb, R., Nagler, T., Nuth, C., Rastner, P., Strozzi, T., Wuite, J., 2017. Error sources and guidelines for quality assessment of glacier area, elevation change, and velocity products derived from satellite data in the Glaciers_cci project. Remote Sensing of Environment 203, 256–275. https://doi.org/10.1016/j.rse.2017.08.038
- Pekel, J. F., Cottam, A., Gorelick, N., Belward, A. S., 2016. High-resolution mapping of global surface water and its long-term changes. Nature 540, 418–422. https://doi.org/10.1038/nature20584
- RGI Consortium, 2023. Randolph Glacier Inventory v7.0. NSIDC, Boulder, USA. https://doi.org/10.5067/f6jmovy5navz
- Scherler, D., Wulf, H., Gorelick, N., 2018. Global assessment of supraglacial debris-cover extents. Geophysical Research Letters 45, 11798–11805. https://doi.org/10.1029/2018GL080158
- Selkowitz, D. J., Forster, R. R., 2016. Automated mapping of persistent ice and snow cover across the western U.S. with Landsat. ISPRS Journal of Photogrammetry and Remote Sensing 117, 126–140. https://doi.org/10.1016/j.isprsjprs.2016.04.001
- Shokory, J. A. N., Lane, S. N., 2023. Patterns and drivers of glacier debris-cover development in the Afghanistan Hindu Kush Himalaya. Journal of Glaciology 69 (277), 1260–1274. https://doi.org/10.1017/jog.2023.14
- Winsvold, S. H., Kääb, A., Nuth, C., 2016. Regional glacier mapping using optical satellite data time series. IEEE Journal of Selected Topics in Applied Earth Observations and Remote Sensing 9 (8), 3698–3711. https://doi.org/10.1109/JSTARS.2016.2527063
- Wulder, M. A., Loveland, T. R., Roy, D. P., Crawford, C. J., Masek, J. G., Woodcock, C. E., Allen, R. G., Anderson, M. C., Belward, A. S., Cohen, W. B., Dwyer, J., Erb, A., Gao, F., Griffiths, P., Helder, D., Hermosilla, T., Hipple, J. D., Hostert, P., Hughes, M. J., Huntington, J., Johnson, D. M., Kennedy, R., Kilic, A., Li, Z., Lymburner, L., McCorkel, J., Pahlevan, N., Scambos, T. A., Schaaf, C., Schott, J. R., Sheng, Y., Storey, J., Vermote, E., Vogelmann, J., White, J. C., Wynne, R. H., Zhu, Z., 2019. Current status of Landsat program, science, and applications. Remote Sensing of Environment 225, 127–147. https://doi.org/10.1016/j.rse.2019.02.015
- Wulder, M. A., Roy, D. P., Radeloff, V. C., Loveland, T. R., Anderson, M. C., Johnson, D. M., Healey, S., Zhu, Z., Scambos, T. A., Pahlevan, N., Hansen, M., Gorelick, N., Crawford, C. J., Masek, J. G., Hermosilla, T., White, J. C., Belward, A. S., Schaaf, C., Woodcock, C. E., Huntington, J. L., Lymburner, L., Hostert, P., Gao, F., Lyapustin, A., Pekel, J. -F., Strobl, P., Cook, B. D., 2022. Fifty years of Landsat science and impacts. Remote Sensing of Environment 280, 113195. https://doi.org/10.1016/j.rse.2022.113195

*Technical University of Munich (TUM)*
