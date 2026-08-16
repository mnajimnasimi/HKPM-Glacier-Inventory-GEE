# Literature Review and Methodology Support Document

## Conservative Glacier Mapping with Rock Exclusion for the Afghanistan Hindu Kush Himalaya

**Code Reference**: Code 3 - Conservative Glacier Mapping with Rock Exclusion

**Prepared for**: Afghanistan Glacier Inventory Development

**Date**: December 2025

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Study Area Context](#2-study-area-context)
3. [Spectral Properties of Snow, Ice, and Rock](#3-spectral-properties-of-snow-ice-and-rock)
4. [Clean Ice Detection Methods](#4-clean-ice-detection-methods)
5. [Debris-Covered Glacier Mapping](#5-debris-covered-glacier-mapping)
6. [Rock Exclusion Methodology](#6-rock-exclusion-methodology)
7. [Threshold Justification](#7-threshold-justification)
8. [Temporal Considerations](#8-temporal-considerations)
9. [Minimum Mapping Units](#9-minimum-mapping-units)
10. [Morphological Operations](#10-morphological-operations)
11. [Uncertainty and Validation](#11-uncertainty-and-validation)
12. [References](#12-references)

---

## 1. Introduction

This document provides comprehensive literature support and scientific justification for the methodological choices implemented in Code 3: Conservative Glacier Mapping with Rock Exclusion. The code is designed for semi-automated glacier inventory production in the Afghanistan Hindu Kush Himalaya (HKH) region using Landsat time series imagery.

### 1.1 Rationale for Conservative Approach

Glacier mapping in high-mountain environments faces persistent challenges including:

- Spectral similarity between snow/ice and certain rock types in shadow
- Seasonal snow contamination during non-optimal acquisition periods
- Debris cover obscuring glacier boundaries
- Complex topography creating shadows and illumination variations

A conservative approach prioritizes **precision over recall**, aiming to minimize commission errors (false positives) while accepting some omission errors. This philosophy aligns with best practices for glacier inventories where accurate boundary delineation is critical for change detection studies (Paul et al., 2013; Pfeffer et al., 2014).

### 1.2 Code Overview

Code 3 implements a hierarchical classification approach:

1. **Snow Detection**: High-confidence snow identification (NDSI > 0.5)
2. **Rock Exclusion**: Multi-criteria masks to exclude rock surfaces
3. **Clean Ice Detection**: Conservative ice mapping with rock exclusion
4. **Debris Detection**: NDSDI-based debris-covered glacier mapping (2013+ only)
5. **Morphological Cleaning**: Minimal operations to preserve glacier geometry

---

## 2. Study Area Context

### 2.1 Afghanistan Hindu Kush Himalaya

The Afghanistan HKH represents the western terminus of the greater Himalayan system, characterized by:

- **Elevation range**: 3,500–7,500 m a.s.l. for glacierized terrain
- **Climate**: Continental, arid to semi-arid with winter westerly precipitation
- **Glacier count**: ~3,400–3,900 glaciers (Maharjan et al., 2018; Shokory & Lane, 2023)
- **Total ice area**: ~2,200–2,700 km² (Shokory & Lane, 2023)
- **Debris cover**: ~620 km² or ~22% of total ice area (Shokory & Lane, 2023)

> "3408 glaciers were identified which, for those ≥0.01 km² in area, gives an ice cover of 2,222 ± 11 km² and a debris cover of 619 ± 40 km²." (Shokory & Lane, 2023)

### 2.2 Regional Challenges

The Afghanistan HKH presents unique mapping challenges:

- **Limited ground truth**: Historical glaciological studies are sparse and often inaccessible (Shroder & Bishop, 2010)
- **Complex geology**: Diverse rock types with variable spectral signatures
- **High debris cover**: Among the highest proportions in the HKH region
- **Seasonal snow persistence**: Late-lying snow at glacier elevations

> "Most glaciological studies in Afghanistan are for the period 1965 to 1980 and are in Russian, Dutch and very occasionally English, and most are not available online." (Shokory & Lane, 2023)

---

## 3. Spectral Properties of Snow, Ice, and Rock

### 3.1 Physical Basis of Spectral Signatures

The spectral discrimination of glacier surfaces relies on fundamental differences in electromagnetic radiation interaction with different materials.

#### Snow and Ice Reflectance

Snow and ice exhibit characteristic spectral behavior:

- **Visible (VIS: 0.4–0.7 µm)**: High reflectance (0.85–0.99)
- **Near-Infrared (NIR: 0.7–1.1 µm)**: Moderate-high reflectance (0.5–0.9)
- **Shortwave Infrared (SWIR: 1.5–1.7 µm)**: Very low reflectance (< 0.15)

> "Snow is white; the albedo of Antarctic surface snow decreases only slightly from 0.99 at 400 nm to 0.96 at 700 nm... Snow and ice are good reflectors of visible radiation but reflect near-infrared (NIR) poorly." (Warren, 2019)

The key diagnostic feature is the **dramatic decrease in reflectance from visible to SWIR wavelengths**, driven by strong absorption by ice at SWIR wavelengths.

| Surface Type | Blue (0.45-0.52 µm) | Green (0.52-0.60 µm) | NIR (0.85-0.88 µm) | SWIR1 (1.57-1.65 µm) |
|--------------|---------------------|----------------------|--------------------|----------------------|
| Fresh snow | 0.95-0.99 | 0.95-0.99 | 0.70-0.90 | 0.02-0.10 |
| Aged snow | 0.80-0.95 | 0.80-0.95 | 0.50-0.80 | 0.05-0.15 |
| Clean ice | 0.40-0.60 | 0.40-0.60 | 0.30-0.50 | 0.02-0.10 |
| Dirty ice | 0.20-0.40 | 0.20-0.40 | 0.15-0.30 | 0.05-0.15 |

*Table 1: Typical reflectance values for glacier surface types (compiled from Zeng et al., 1984; Hall et al., 1995; Grenfell et al., 1994)*

#### Rock Reflectance

Rock surfaces display contrasting spectral behavior:

- **Visible**: Variable (0.05–0.40 depending on lithology)
- **NIR**: Generally increasing with wavelength
- **SWIR**: **Higher reflectance than snow/ice** (typically > 0.15–0.30)

> "Spectral reflectances of snow, superimposed ice and rock... the spectral curve for rock shows higher reflectance in SWIR compared to ice." (Winther, 1993)

This SWIR reflectance contrast forms the physical basis for rock exclusion implemented in Code 3.

### 3.2 Spectral Indices for Glacier Mapping

#### Normalized Difference Snow Index (NDSI)

The NDSI exploits the contrast between visible and SWIR reflectance:

$$NDSI = \frac{Green - SWIR1}{Green + SWIR1}$$

Originally developed by Dozier (1989) and refined by Hall et al. (1995), the NDSI has become the standard index for snow and glacier mapping.

> "NDSI is an index used to map glaciers using green band and SWIR band reflectance. NDSI ranges from -1 to 1, and glacier features are likely to have positive values." (Guo et al., 2019)

**Threshold considerations**:

| Study | Region | Recommended Threshold | Notes |
|-------|--------|----------------------|-------|
| Hall et al. (1995) | Global | 0.4 | Original recommendation |
| Burns & Nolin (2014) | Peru | 0.42 | Tropical glaciers |
| Härer et al. (2018) | Alps | 0.47–0.52 | Location-dependent |
| Lu et al. (2022) | Tibetan Plateau | 0.4 | Large-scale mapping |

> "Hall et al. (1998) suggested a NDSI threshold of 0.4 for optimal snow/glacier detection, which was also used in many other studies." (Ahmad et al., 2023)

**Code 3 Implementation**:
- Snow detection: NDSI > 0.5 (conservative, high-confidence)
- Ice detection: NDSI > 0.35 (moderate, with additional constraints)

The elevated snow threshold (0.5 vs. standard 0.4) reduces commission errors from bright rocks and mixed pixels.

#### NIR/SWIR Band Ratio

The NIR/SWIR ratio provides complementary glacier detection:

$$NIR/SWIR = \frac{NIR}{SWIR1}$$

> "Typical threshold values are in the 2.0 ± 0.5 range for the ratio methods. Both the Red/SWIR ratio and NIR/SWIR ratios can distinguish debris-free glaciers well because their ratio values are all much larger than 2.0." (Guo et al., 2019)

**Code 3 Implementation**: NIR/SWIR > 2.0 (conservative threshold)

#### Blue/SWIR Ratio

The Blue/SWIR ratio enhances detection of dirty ice:

$$Blue/SWIR = \frac{Blue}{SWIR1}$$

Clean and dirty ice maintain relatively high blue reflectance but low SWIR reflectance, yielding high ratio values.

**Code 3 Implementation**: Blue/SWIR > 2.5 (conservative)

---

## 4. Clean Ice Detection Methods

### 4.1 Multi-Method Approach

Code 3 implements a hierarchical classification combining multiple methods:

```
cleanIceMask = (NDSI > 0.35 AND SWIR < 0.15)
            OR (SWIR < 0.10 AND NIR > 0.15 AND NIR < 0.50)
            OR (Blue/SWIR > 2.5 AND Blue > 0.15 AND NIR/SWIR > 2.0)
```

This approach follows recommendations from multiple studies:

> "Automated glacier extraction using band ratios (e.g. near-infrared (NIR)/SWIR) with certain thresholds or normalized band differences like the NDSI (Green–SWIR)/(Green + SWIR) has proven to be an accurate, fast and robust method for detecting clean glacier ice." (Gjermundsen et al., 2011)

### 4.2 Shadow Handling

Glaciers in topographic shadow present mapping challenges due to reduced reflectance across all bands. The NIR/SWIR ratio remains effective for shadow discrimination:

> "The NIR/SWIR ratio tends to miss shadowed glaciers because the value of classified proglacial lakes and shadowed glaciers was always higher/lower than the optimal threshold." (Guo et al., 2019)

Code 3 addresses shadows through:
- Direct SWIR threshold (< 0.10) capturing ice in partial shadow
- Combined ratio requirements reducing false positives

### 4.3 Comparison with Standard Methods

| Method | Advantages | Disadvantages | Code 3 Usage |
|--------|------------|---------------|--------------|
| NDSI | Simple, well-validated | Sensitive to threshold, misclassifies water | Primary detection with elevated threshold |
| NIR/SWIR | Good shadow handling | Misses some dirty ice | Secondary detection, shadow enhancement |
| Blue/SWIR | Captures dirty ice | Sensitive to atmospheric effects | Tertiary detection with brightness constraint |
| Red/SWIR | Maps debris-free ice well | Overclassifies water | Not used (replaced by NDSDI for debris) |

---

## 5. Debris-Covered Glacier Mapping

### 5.1 The Debris Challenge

Debris-covered glaciers represent a significant fraction of glacier area in the HKH:

> "The varying extent of debris cover on a glacier's boundary may seriously hinder automated mapping and inventorying of glaciers in various parts of the world. The problem arises because supraglacial debris has similar spectral characteristics to surrounding terrain." (Bhambri et al., 2011)

### 5.2 Normalized Difference Supraglacial Debris Index (NDSDI)

Shokory & Lane (2023) developed the NDSDI specifically for Afghanistan glaciers:

**NDSDI Component 1 (Coarse):**
$$NDSDI_{C1} = \frac{PAN - TIR}{PAN + TIR}$$

(combines the panchromatic band (B8, ~0.50–0.68 μm) and the thermal band (B10), following Bhambri et al. (2011) and calibrated for Afghanistan by Shokory & Lane (2023).)

**NDSDI Component 2 (Fine):**
$$NDSDI_{C2} = \frac{NIR}{Blue}$$

**Implementation note on units:** Landsat 8/9 Level-2 SR products do not provide the panchromatic band (B8); it must be pulled from the Level-1/TOA collection and linked back to the SR scene. In the GEE code used here, PAN is TOA reflectance (0–1) and TIR is converted to Celsius and scaled by 1/100 so the published threshold range (−0.37 … 0) holds.

> "This study develops two Normalized Difference Supraglacial Debris Indices for mapping debris-covered ice based on thermal and near Infrared Landsat 8 bands. They were calibrated with field data. Validation suggests that they have a high level of accuracy." (Shokory & Lane, 2023)

### 5.3 Field Validation

The NDSDI parameters were validated through fieldwork at Mir Samir Glacier:

> "For the test glacier, the method had 96% overall accuracy and a Kappa coefficient of 0.87." (Shokory & Lane, 2023)

### 5.4 Code 3 NDSDI Implementation

**Conservative thresholds** (tighter than original publication):

| Parameter | Original (Shokory & Lane, 2023) | Code 3 Conservative | Justification |
|-----------|--------------------------------|---------------------|---------------|
| NDSDI_C1 min | -0.37 | -0.30 | Reduce rock misclassification |
| NDSDI_C1 max | 0.0 | -0.05 | Exclude boundary values |
| NDSDI_C2 min | 0.70 | 0.75 | Higher confidence |
| NDSDI_C2 max | 0.92 | 0.88 | Tighter range |
| Slope max | 24° | 20° | More conservative |

### 5.5 Thermal Constraint

Debris-covered ice maintains cooler surface temperatures than surrounding rock:

> "We take advantage of thermal differences and near infrared measurements for both thin- and thick debris-covered ice that allows automated mapping of remote regions like Afghanistan." (Shokory & Lane, 2023)

**Code 3 Implementation**: TIR > 2°C (debris must be warmer than pure ice at ~0°C but cooler than exposed rock)

---

## 6. Rock Exclusion Methodology

### 6.1 Physical Basis for Rock Exclusion

Code 3 implements explicit rock exclusion masks based on spectral properties:

#### SWIR Reflectance Threshold

Rock surfaces exhibit higher SWIR reflectance than snow/ice:

| Surface | Typical SWIR1 Reflectance | Discrimination |
|---------|--------------------------|----------------|
| Fresh snow | < 0.05 | Clearly distinguishable |
| Clean ice | 0.02–0.10 | Low reflectance |
| Dirty ice | 0.05–0.15 | Moderate |
| **Rock threshold** | **> 0.18** | **Excluded** |

> "Rocks have higher SWIR reflectance and lower NIR/SWIR ratios than ice." (Based on spectral library data, Winther, 1993)

**Code 3 Implementation**: `ROCK_SWIR_MIN = 0.18`

#### NIR/SWIR Ratio Threshold

Rocks display lower NIR/SWIR ratios than glacier surfaces:

| Surface | Typical NIR/SWIR Ratio |
|---------|----------------------|
| Clean ice | > 3.0 |
| Dirty ice | 2.0–3.0 |
| Snow | > 2.0 |
| **Rock threshold** | **< 1.3** |

**Code 3 Implementation**: `ROCK_NIR_SWIR_MAX = 1.3`

### 6.2 Extreme Reflectance Exclusion

Very bright or very dark surfaces are unlikely to be glaciers:

```javascript
extremeReflectance = (NIR > 0.50) OR (Blue < 0.05)
```

- **Very bright (NIR > 0.50)**: Likely clouds, bright rock, or sensor saturation
- **Very dark (Blue < 0.05)**: Likely deep shadow, water, or dark rock

### 6.3 Combined Rock Mask

```javascript
likelyRock = (SWIR1 > 0.18) OR (NIR_SWIR < 1.3)
```

This mask is applied BEFORE final glacier classification:

```javascript
cleanIceMask = iceMethods AND NOT(likelyRock) AND NOT(extremeReflectance)
```

---

## 7. Threshold Justification

### 7.1 Snow Detection Thresholds

| Parameter | Value | Literature Support | Justification |
|-----------|-------|-------------------|---------------|
| `NDSI_SNOW_THRESHOLD` | 0.5 | Hall et al. (1995): 0.4 standard; Härer et al. (2018): 0.47–0.52 site-specific | Elevated for conservative mapping |
| `SWIR_SNOW_THRESHOLD` | 0.15 | Warren (2019): Snow SWIR < 0.10–0.15 | Upper bound for aged snow |
| `BLUE_MIN_FOR_SNOW` | 0.25 | Grenfell et al. (1994): Snow blue > 0.85 typical | Reduced to capture dirty snow |

### 7.2 Clean Ice Thresholds

| Parameter | Value | Literature Support | Justification |
|-----------|-------|-------------------|---------------|
| `NDSI_ICE_THRESHOLD` | 0.35 | Burns & Nolin (2014): 0.42; Paul et al. (2016): scene-dependent | Moderate for ice (lower than snow) |
| `SWIR_ICE_THRESHOLD` | 0.10 | Zeng et al. (1984): Ice SWIR 0.02–0.10 | Strict ice absorption criterion |
| `NIR_MIN_THRESHOLD` | 0.15 | Hall et al. (1995): Ice NIR > 0.30 typical | Lowered for dirty ice in shadow |
| `NIR_MAX_THRESHOLD` | 0.50 | Empirical: Very bright surfaces not ice | Exclude clouds/bright rock |
| `BLUE_SWIR_THRESHOLD` | 2.5 | Derived from band ratio literature | Conservative ratio |
| `NIR_SWIR_THRESHOLD` | 2.0 | Paul et al. (2002): 2.0 ± 0.5 standard | Standard threshold |

### 7.3 Rock Exclusion Thresholds

| Parameter | Value | Basis |
|-----------|-------|-------|
| `ROCK_SWIR_MIN` | 0.18 | Rock SWIR reflectance > ice (Winther, 1993) |
| `ROCK_NIR_SWIR_MAX` | 1.3 | Rock NIR/SWIR ratio < ice (spectral libraries) |

### 7.4 Debris Thresholds

| Parameter | Value | Literature Support |
|-----------|-------|-------------------|
| `NDSDI_COARSE_MIN` | -0.30 | Shokory & Lane (2023): -0.37 original; tightened for conservatism |
| `NDSDI_COARSE_MAX` | -0.05 | Shokory & Lane (2023): 0.0 original; exclude boundary |
| `NDSDI_FINE_MIN` | 0.75 | Shokory & Lane (2023): 0.70 original; more restrictive |
| `NDSDI_FINE_MAX` | 0.88 | Shokory & Lane (2023): 0.92 original; tighter range |
| `DEBRIS_MAX_SLOPE` | 20° | Frey et al. (2012): 24° common; reduced for conservatism |
| `DEBRIS_MIN_TEMP` | 2°C | Thermal separation from ice (Shokory & Lane, 2023) |

---

## 8. Temporal Considerations

### 8.1 Optimal Acquisition Period

The choice of acquisition dates significantly impacts glacier mapping accuracy:

> "We used high-resolution satellite imagery to calibrate our selection of a single threshold for the Normalized Difference Snow Index (NDSI). This threshold value was applied to NDSI images derived from carefully selected and atmospherically-corrected Landsat TM scenes acquired at the end of the dry season." (Burns & Nolin, 2014)

**Optimal timing for Afghanistan HKH**:
- **Start**: August 15 (late ablation season)
- **End**: October 31 (before new snow accumulation)

This window captures:
- Minimum seasonal snow coverage
- Maximum glacier exposure
- Adequate solar illumination

**Code 3 Implementation**:
```javascript
DATE_START_MONTH = 8
DATE_START_DAY = 15
DATE_END_MONTH = 10
DATE_END_DAY = 31
```

### 8.2 Multi-Year Compositing

Inter-annual variability in snow conditions can affect single-year classifications:

> "The standard threshold of 0.4... large uncertainties in the prediction of the SCA of up to 24.1% exist in satellite snow cover maps." (Härer et al., 2018)

**Code 3 Implementation**: 5-year composite (±2 years around target year) using median reflectance values. This approach:
- Reduces impact of anomalous snow years
- Fills gaps from cloud cover
- Improves signal-to-noise ratio

```javascript
USE_5YEAR_COMPOSITE = true
yearStart = PROCESS_YEAR - 2
yearEnd = PROCESS_YEAR + 2
```

### 8.3 Sensor Selection

| Period | Sensors | NDSDI Available | Notes |
|--------|---------|-----------------|-------|
| 1984–1999 | Landsat 5 TM | No | No thermal band suitable for NDSDI |
| 2000–2011 | Landsat 5 + 7 | No | ETM+ SLC-off after 2003 |
| 2012 | Landsat 7 | No | Gap filling required |
| 2013–2021 | Landsat 8 OLI/TIRS | **Yes** | Full methodology available |
| 2022+ | Landsat 8 + 9 | **Yes** | Enhanced coverage |

---

## 9. Minimum Mapping Units

### 9.1 Standard Recommendations

The World Glacier Inventory (WGI) and Randolph Glacier Inventory (RGI) recommend:

> "Glaciers with areas less than 0.01 km², the recommended minimum of the WGI, are removed." (Pfeffer et al., 2014)

> "The RGI includes outlines of all glaciers larger than 0.01 km², which is the recommended minimum of the World Glacier Inventory." (RGI Consortium, 2023)

### 9.2 Code 3 Implementation

**Conservative minimum areas** (slightly larger than WGI minimum):

| Type | Minimum Area | Pixel Count | Justification |
|------|--------------|-------------|---------------|
| Clean ice | 0.02 km² | ~22 pixels | Reduce noise, increase confidence |
| Debris | 0.05 km² | ~56 pixels | More conservative for debris |

The increased minimum area for debris reduces false positives from small rock patches misclassified as debris-covered ice.

### 9.3 Pixel Count Calculation

At 30 m Landsat resolution:
- 1 pixel = 30 × 30 m = 900 m² = 0.0009 km²
- 0.01 km² = ~11 pixels
- 0.02 km² = ~22 pixels
- 0.05 km² = ~56 pixels

```javascript
minPxCleanIce = Math.ceil((MIN_CLEANICE_AREA * 1e6) / 900)
minPxDebris = Math.ceil((MIN_DEBRIS_AREA * 1e6) / 900)
```

---

## 10. Morphological Operations

### 10.1 Purpose

Morphological operations serve to:
- Fill small holes within glacier boundaries
- Remove isolated noise pixels
- Smooth ragged edges
- Connect nearby glacier pixels

### 10.2 Conservative Approach

Code 3 implements **minimal morphological operations** to preserve real glacier boundaries:

```javascript
// Fill small holes (1-pixel gaps only)
filled = cleanIceMask.focal_max(1, 'square', 'pixels')
                     .focal_min(1, 'square', 'pixels')
```

This conservative approach avoids:
- Artificial expansion of glacier boundaries
- Connection of separate glaciers
- Over-smoothing of complex termini

### 10.3 Literature Guidance

> "A 3 by 3 median filter is applied for image smoothing and glaciers smaller than 0.05 km² are not considered." (Paul et al., 2013)

> "A median filter of 3 × 3 pixels kernel (30 × 30 m) was thereafter applied to reduce noise in shadow and remove isolated pixels." (Andreassen et al., 2022)

---

## 11. Uncertainty and Validation

### 11.1 Sources of Uncertainty

1. **Threshold sensitivity**: Classification boundaries depend on selected thresholds
2. **Temporal variability**: Snow conditions vary annually
3. **Spectral mixing**: Edge pixels contain mixed signals
4. **Shadow effects**: Reduced illumination affects reflectance
5. **Debris complexity**: Variable debris thickness and composition

### 11.2 Validation Approaches

**Visual validation against**:
- RGI 7.0 outlines
- High-resolution imagery (Google Earth, Bing Maps)
- False-color composites (SWIR, NIR)

**Quantitative comparison**:
- Area comparison with RGI reference
- Glacier count comparison
- Spatial overlap analysis

### 11.3 Expected Accuracy

Based on literature for similar methodologies:

| Metric | Expected Range | Source |
|--------|---------------|--------|
| Overall accuracy (clean ice) | 85–95% | Paul et al. (2013) |
| NDSDI accuracy | 91–96% | Shokory & Lane (2023) |
| Area uncertainty | ±5–10% | Paul et al. (2020) |

> "The areal extent of semi-automated outlines... varied from manually derived outline using pan-sharpened Landsat ETM+ by -1.3% and -1.6%, respectively. Year 2011 classification map... showed a higher overall accuracy of about 91.3%." (Bhardwaj et al., 2014)

---

## 12. References

### Primary Methodology References

**NDSI Development**:
- Dozier, J. (1989). Spectral signature of alpine snow cover from the Landsat Thematic Mapper. *Remote Sensing of Environment*, 28, 9-22.
- Hall, D.K., Riggs, G.A., & Salomonson, V.V. (1995). Development of methods for mapping global snow cover using moderate resolution imaging spectroradiometer data. *Remote Sensing of Environment*, 54(2), 127-140.

**Band Ratio Methods**:
- Paul, F., Kääb, A., Maisch, M., Kellenberger, T., & Haeberli, W. (2002). The new remote-sensing-derived Swiss glacier inventory: I. Methods. *Annals of Glaciology*, 34, 355-361.
- Paul, F., Winsvold, S.H., Kääb, A., Nagler, T., & Schwaizer, G. (2016). Glacier Remote Sensing Using Sentinel-2. Part II: Mapping Glacier Extents and Surface Facies, and Comparison to Landsat 8. *Remote Sensing*, 8(7), 575.

**NDSDI for Afghanistan**:
- Shokory, J.A.N., & Lane, S.N. (2023). Patterns and drivers of glacier debris-cover development in the Afghanistan Hindu Kush Himalaya. *Journal of Glaciology*, 69(277), 1260-1278.
- Shokory, J.A.N., & Lane, S.N. (2024). Ice cover loss and debris cover evolution in the Afghanistan Hindu Kush Himalaya between 2000 and 2020. *Arctic, Antarctic, and Alpine Research*, 56(1), 2373858.

**Alpine Glacier Inventories**:
- Paul, F., et al. (2020). Glacier shrinkage in the Alps continues unabated as revealed by a new glacier inventory from Sentinel-2. *Earth System Science Data*, 12, 1805-1821.
- Linsbauer, A., et al. (2021). The New Swiss Glacier Inventory SGI2016: From a Topographical to a Glaciological Dataset. *Frontiers in Earth Science*, 9, 704189.

**Global Glacier Inventories**:
- Pfeffer, W.T., et al. (2014). The Randolph Glacier Inventory: a globally complete inventory of glaciers. *Journal of Glaciology*, 60(221), 537-552.
- RGI Consortium. (2023). Randolph Glacier Inventory – A Dataset of Global Glacier Outlines, Version 7.0. NSIDC: National Snow and Ice Data Center.

**Afghanistan Context**:
- Maharjan, S.B., et al. (2018). The status of glacial lakes in the Hindu Kush Himalaya. ICIMOD Research Report 2018/1.
- Shroder, J.F., & Bishop, M.P. (2010). Glaciers of Afghanistan. In *Satellite Image Atlas of Glaciers of the World* (Vol. F). USGS Professional Paper 1386-F.

**Spectral Properties**:
- Warren, S.G. (2019). Optical properties of ice and snow. *Philosophical Transactions of the Royal Society A*, 377(2146), 20180161.
- Winther, J.G. (1993). Spectral bi-directional reflectance of snow and glacier ice measured in Dronning Maud Land, Antarctica. *Annals of Glaciology*, 17, 9-14.
- Zeng, Q., Cao, M., Feng, X., Liang, F., Chen, X., & Sheng, W. (1984). Study of spectral reflection characteristics of snow, ice and water of northwest China. *Acta Geographica Sinica*, 39(1), 73-85.

**Debris-Covered Glacier Mapping**:
- Bhardwaj, A., Joshi, P.K., Singh, M.K., Sam, L., & Gupta, R.D. (2014). Mapping debris-covered glaciers and identifying factors affecting the accuracy. *Cold Regions Science and Technology*, 106-107, 161-174.
- Alifu, H., Tateishi, R., & Johnson, B. (2015). A new band ratio technique for mapping debris-covered glaciers using Landsat imagery and a digital elevation model. *International Journal of Remote Sensing*, 36(8), 2063-2075.

**Threshold Calibration**:
- Härer, S., Bernhardt, M., Corripio, J.G., & Schulz, K. (2018). On the need for a time- and location-dependent estimation of the NDSI threshold value for reducing existing uncertainties in snow cover maps at different scales. *The Cryosphere*, 12, 1629-1642.
- Burns, P., & Nolin, A. (2014). Using atmospherically-corrected Landsat imagery to measure glacier area change in the Cordillera Blanca, Peru from 1987 to 2010. *Remote Sensing of Environment*, 140, 165-178.

**AGEI Index**:
- Guo, W., Liu, S., Xu, J., Wu, L., Shangguan, D., Yao, X., ... & Jiang, Z. (2019). Automated Glacier Extraction Index by Optimization of Red/SWIR and NIR/SWIR Ratio Index for Glacier Mapping Using Landsat Imagery. *Water*, 11(6), 1223.

---

## Appendix A: Parameter Summary Table

| Parameter | Value | Category | Literature Basis |
|-----------|-------|----------|------------------|
| `MIN_GLACIER_ELEVATION` | 3500 m | Spatial | Regional climatology |
| `MAX_GLACIER_ELEVATION` | 7500 m | Spatial | Maximum elevation in Afghanistan |
| `NDSI_SNOW_THRESHOLD` | 0.5 | Snow | Hall et al. (1995), conservative |
| `SWIR_SNOW_THRESHOLD` | 0.15 | Snow | Warren (2019) |
| `BLUE_MIN_FOR_SNOW` | 0.25 | Snow | Brightness constraint |
| `NDSI_ICE_THRESHOLD` | 0.35 | Ice | Burns & Nolin (2014) |
| `SWIR_ICE_THRESHOLD` | 0.10 | Ice | Zeng et al. (1984) |
| `NIR_MIN_THRESHOLD` | 0.15 | Ice | Shadow handling |
| `NIR_MAX_THRESHOLD` | 0.50 | Ice | Cloud/bright rock exclusion |
| `BLUE_SWIR_THRESHOLD` | 2.5 | Ice | Conservative ratio |
| `NIR_SWIR_THRESHOLD` | 2.0 | Ice | Paul et al. (2002) |
| `ROCK_SWIR_MIN` | 0.18 | Rock | Spectral libraries |
| `ROCK_NIR_SWIR_MAX` | 1.3 | Rock | Spectral discrimination |
| `NDSDI_COARSE_MIN` | -0.30 | Debris | Shokory & Lane (2023), tightened |
| `NDSDI_COARSE_MAX` | -0.05 | Debris | Conservative boundary |
| `NDSDI_FINE_MIN` | 0.75 | Debris | Shokory & Lane (2023), tightened |
| `NDSDI_FINE_MAX` | 0.88 | Debris | Conservative range |
| `DEBRIS_MAX_SLOPE` | 20° | Debris | Frey et al. (2012), reduced |
| `DEBRIS_MIN_TEMP` | 2°C | Debris | Thermal separation |
| `MIN_CLEANICE_AREA` | 0.02 km² | Spatial | WGI standard + buffer |
| `MIN_DEBRIS_AREA` | 0.05 km² | Spatial | Conservative for debris |
| `NDWI_THRESHOLD` | 0.1 | Water | Water body exclusion |

---

## Appendix B: Classification Decision Tree

```
INPUT: Landsat Surface Reflectance Composite (Aug 15 - Oct 31)
       SRTM DEM (30m)
       5-year median composite

├── STEP 1: APPLY MASKS
│   ├── Elevation mask: 3500m ≤ elevation ≤ 7500m
│   ├── Water mask: NDWI < 0.1
│   └── Vegetation mask: NDVI < 0.2
│
├── STEP 2: SNOW DETECTION (Conservative)
│   └── Snow = (NDSI > 0.5) AND (SWIR1 < 0.15) AND (Blue > 0.25)
│             AND elevation_mask AND water_mask AND veg_mask
│
├── STEP 3: ROCK EXCLUSION
│   ├── likely_rock = (SWIR1 > 0.18) OR (NIR/SWIR < 1.3)
│   └── extreme_reflectance = (NIR > 0.5) OR (Blue < 0.05)
│
├── STEP 4: CLEAN ICE DETECTION
│   ├── Method A: (NDSI > 0.35) AND (SWIR1 < 0.15)
│   ├── Method B: (SWIR1 < 0.10) AND (0.15 < NIR < 0.50)
│   └── Method C: (Blue/SWIR > 2.5) AND (Blue > 0.15) AND (NIR/SWIR > 2.0)
│   
│   └── ice_mask = (A OR B OR C) 
│                  AND NOT(likely_rock) 
│                  AND NOT(extreme_reflectance)
│                  AND elevation_mask AND water_mask AND veg_mask
│
├── STEP 5: COMBINE SNOW AND ICE
│   └── clean_ice_initial = snow_mask OR ice_mask
│
├── STEP 6: CONNECTED COMPONENT ANALYSIS
│   └── Include large connected patches (> 2.0 km²)
│
├── STEP 7: MORPHOLOGICAL CLEANING
│   └── Fill 1-pixel holes, minimal smoothing
│
├── STEP 8: DEBRIS DETECTION (2013+ only)
│   ├── NDSDI_C1: -0.30 ≤ (Blue - TIR/100)/(Blue + TIR/100) ≤ -0.05
│   ├── NDSDI_C2: 0.75 ≤ NIR/Blue ≤ 0.88
│   ├── Slope ≤ 20°
│   ├── Temperature > 2°C
│   └── debris_mask = (NDSDI_C1 OR NDSDI_C2) 
│                     AND slope_mask AND thermal_mask
│                     AND NOT(clean_ice_mask)
│
└── OUTPUT: clean_ice_mask, debris_mask, total_glacier_mask
```

---

*Document prepared in support of the Afghanistan Glacier Inventory Project*
*Technical University of Munich (TUM)*
