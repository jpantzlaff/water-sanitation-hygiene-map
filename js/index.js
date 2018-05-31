let hoverEnabled = true;
let chartHoverActive = false;
let featureHoverActive = false;
$('#country-stats, #region-stats').hide();

/* List of possible themes (display modes), including text and color ramps to display */
let themes = {
    drinking: {
        title: 'Basic and safely managed drinking water services',
        suffix: '%',
        stat: 'of population has access',
        chartStat: 'Population with access',
        colors: ['#0cf', '#ccc'],
    },
    sanitation: {
        title: 'Basic and safely managed sanitation services',
        suffix: '%',
        stat: 'of population has access',
        chartStat: 'Population with access',
        colors: ['#2c7', '#ccc']
    },
    handwashing: {
        title: 'Handwashing with soap',
        suffix: '%',
        stat: 'of population practices',
        chartStat: 'Practicing population',
        colors: ['#07f', '#ccc']
    },
    defecation: {
        title: 'Open defecation',
        suffix: '%',
        stat: 'of population practices',
        chartStat: 'Practicing population',
        colors: ['#ccc', '#f50']
    },
    mortality: {
        title: 'Mortality attributed to unsafe WASH services',
        suffix: '',
        stat: 'deaths per 100,000 people',
        chartStat: 'Deaths per 100,000 people',
        colors: ['#ccc', '#fd0']
    }
};

/* List of statistics provided for context in the info box (bottom panel) */
let contextStats = {
    region: {
        title: 'Region',
        /* This statistic should not be displayed at all when a region is the active feature */
        regional: false
    },
    gdp: {
        title: 'Gross Domestic Product',
        /* When the active feature is a region, a sum of all of the values of its constituent countries should be displayed */
        regional: 'sum'
    },
    gni: {
        title: 'Gross National Income per Capita',
        /* When the active feature is a region, the mean of all of the values of its constituent countries should be displayed */
        regional: 'mean'
    },
    fsi: {
        title: 'Fragile States Index',
        regional: 'mean'
    }
};

/* Initialize the application with no feature being active */
let activeFeature = null;

/* Create a Leaflet map in the "map" div */
let map = L.map('map', {
    /* Render with Canvas rather than the default SVG */
    renderer: L.canvas({
        padding: 3
    }),
    /* Restrict zooming to a few zoom levels */
    minZoom: 3,
    maxZoom: 5,
    /* Limit panning to the area of interest */
    maxBounds: [[-55, -55], [70, 170]],
    maxBoundsViscosity: 0.9,
    /* Remove zoom buttons */
    zoomControl: false,
    /* Remove default attribution control, as one has been made separately */
    attributionControl: false
});
/* Set the map's initial extent to the area of interest */
map.fitBounds([[-38, -30], [56, 155]]);

/* Create the basemap layer and add to map */
L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png', {
	subdomains: 'abcd'
}).addTo(map);

/* Create a map pane to hold labels, as these should display above everything else on the map */
map.createPane('labels');
/* Set a z-index that will achieve the intended result: above everything but the tooltip */
map.getPane('labels').style.zIndex = 450;
/* Don't capture any pointer events in this labels pane, allowing pointer interactions to make it "down" to the country features */
map.getPane('labels').style.pointerEvents = 'none';

/* Create the labels layer and add to the map - specifically, the labels pane */
L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_only_labels/{z}/{x}/{y}.png', {
	subdomains: 'abcd',
    pane: 'labels'
}).addTo(map);

/* Create an attribution control containing all of the attribution for the various data sources and add to the map */
L.control.attribution({
    position: 'bottomright',
    prefix: `<a href="http://leafletjs.com">Leaflet</a> | Basemap: &copy;&nbsp;<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy;&nbsp;<a href="https://carto.com/attribution/">CARTO</a> | Countries: <a href="http://www.naturalearthdata.com/">Natural Earth</a> | Economic Indicators: <a href="http://www.worldbank.org/">The World Bank</a> | Fragile States Index: <a href="http://global.fundforpeace.org/index.php">Fund for Peace</a> | WASH Data: <a href="http://www.who.int/">World Health Organization</a> | <a href="#" onclick="$('#credits').fadeIn(1000)">Full Credits</a>`
}).addTo(map);

/* Create empty GeoJSON-based layers to store the country features and the active feature */
let countries = L.geoJSON();
let active = L.geoJSON();

/* Request the TopoJSON data containing the country and region features via AJAX */
$.get({
    url: 'data/combined.topojson',
    /* Expect JSON in response */
    dataType: 'json',
    /* When the response is received: */
    success: function(d) {
        /* Assign the countries portion of the TopoJSON to a global variable */
        countryData = topojson.feature(d, d.objects.countries);
        /* For each contextual statistic: */
        $.each(contextStats, function(stat, v) {
            /* Add elements to the document that are ready to display the contextual information; elements in the "region" class display only when a region is the active feature, while those in "country" only appear when a country is active */
            $('#context').append(`
                <div class="${(!!v.regional ? 'region country stat' : 'country stat')}">
                    <p>${v.title}</p>
                    <p class="${(!!v.regional ? 'region stat' : 'stat')}">(${v.regional})</p>
                    <p id="${stat}-stat"></p>
                </div>
            `);
        });
        /* For each theme: */
        $.each(themes, function(theme, v) {
            /* Repeat much of the same as line 124, creating places in the document to display the information as it's requested */
            $('#country-stats').append(`
                <div>
                    <p>${v.title}</p>
                    <p id="${theme}-stat"></p>
                    <p>${v.stat}</p>
                </div>
            `);
            $('#region-stats').append(`
                <div>
                    <p>${v.title}</p>
                    <p>${v.chartStat}</p>
                    <div id="${theme}-list"></div>
                </div>
            `);
            /* SCALE CREATION */
            /* Create an empty array to hold of the attribute values for this theme */
            let values = [];
            /* Push the values into the array */
            countryData.features.forEach(i => values.push(i.properties[theme]));
            /* Calculate the minimum value present */
            v.min = Math.min(...values);
            /* Calculate the maximum value present */
            v.max = Math.max(...values);
            /* Using the min/max values and this theme's color ramp, create a scale that's used to color the charts and country features */
            v.scale = d3.scaleLinear()
                .domain([v.min, v.max])
                .range(v.colors);
            /* Do the same for opacity - more saturated colors will be made more opaque to accentuate areas in need */
            v.opacity = d3.scaleLinear()
                .domain([v.min, v.max])
                .range([0.75, 0.75]);
            /* Create another scale to determine the height of the bars in the chart */
            v.height = d3.scaleLinear()
                .domain([v.min, v.max])
                .range([2, 100]);
            
            /* Append an empty chart to the side panel, along with the relevant title, min/max values, and X-axis label */
            $('#charts').append(`
                <div id="${theme}-chart" class="chart-tile">
                    <p class="chart-title">${themes[theme].title}</p>
                    <div class="chart-parent">
                        <div class="chart"></div>
                    </div>
                    <div class="chart-labels">
                        <p>${formatStat(v.min, theme)}</p>
                        <p>${v.chartStat}</p>
                        <p>${formatStat(v.max, theme)}</p>
                    </div>
                </div>
            `);
            /* Bind event listeners to the new chart */
            $(`#${theme}-chart`)
                .on('click', () => drawCountries(theme, 'click'))
                .on('mouseout', function() {
                    chartHoverActive = false;
                    setTimeout(() => {
                        if (!chartHoverActive) drawCountries(theme, 'mouseout');
                    }, 200);
                })
                .on('mouseover', function(e) {
                    if (hoverEnabled) {
                        chartHoverActive = true;
                        setTimeout(() => {
                            if ($(e.target).filter(':hover').length > 0) drawCountries(theme, 'mouseover');
                        }, 200);
                    }
                });
            
            let chart = d3.select(`#${theme}-chart .chart`);

            /* Make a selection to begin inserting bars */
            let bars = chart.selectAll('.bars')
                /* Set the data source as the country data object */
                .data(countryData.features)
                /* Recurse through the object */
                .enter()
                .filter(d => d.properties[theme] !== null)
                /* Append a div for each bar */
                .append('div')
                /* Sort the bars by value */
                .sort((a, b) => a.properties[theme] - b.properties[theme])
                /* Set class names for the bars; all are in "bar", and each bar is also added to a class based on its value */
                .attr('class', d => 'bar ' + d.properties.abbr)
                /* Set the fill color using the same scales as the map */
                .style('background-color', d => themes[theme].scale(d.properties[theme]))
                /* Set the height of each bar using its value, scaled between 0 and 100 */
                .style('height', d => themes[theme].height(d.properties[theme]) + '%')
                .on('click', makeActiveD3)
                .on('mouseover', makeActiveD3)
                .on('mouseout', makeActiveD3);
        });
        /* Assign the regions portion of the TopoJSON to a global variable */
        regionData = topojson.feature(d, d.objects.regions);
        
        /* For each region: */
        for (i = 0; i < regionData.features.length; i++) {
          /* Get the properties of the region  */
            let rProp = regionData.features[i].properties;
            /* For each theme, add an object to the themes object to store this region's statistic */
            $.each(themes, (i, v) => v[rProp.name] = []);
            /* For each statistic in the regional info box, add an array to the region's object to store data values */
            ['gdp', 'gni', 'fsi', 'countries'].forEach(p => rProp[p] = []);
            /* For each country: */
            countryData.features.forEach(c => {
                /* Get the country's properties */
                let cProp = c.properties;
                /* If the current country is in the current region: */
                if (cProp.region === rProp.name) {
                    /* Add this country's GDP, GNI, FSI, and name to this region's statistic arrays (made at line 219) */
                    rProp.gdp.push(cProp.gdp);
                    rProp.gni.push(cProp.gni);
                    rProp.fsi.push(cProp.fsi);
                    rProp.countries.push(cProp.abbr);
                    /* For each theme, add this country's statistics to this theme's array in this region's object (made at line 217) */
                    $.each(themes, i => themes[i][rProp.name].push([cProp.name, cProp[i]]));
                }
            });
            /* For each theme: */
            $.each(themes, (theme, v) => {
                /* If the current theme is defecation or mortality, sort this theme's array in place (descending) */
                if (theme === 'defecation' || theme === 'mortality') v[rProp.name] = sortInArray(v[rProp.name], true);
                /* Otherwise, sort this theme's array in place (ascending) */
                else v[rProp.name] = sortInArray(v[rProp.name], false);
            });
            /* Calculate this region's sum of GDPs, mean of GNIs, and mean of FSIs */
            rProp.gdp = arrayStat(rProp.gdp, 'sum');
            rProp.gni = arrayStat(rProp.gni, 'mean');
            rProp.fsi = arrayStat(rProp.fsi, 'mean');
        }
        /* Add the country features to the map using the "drinking" theme */
        drawCountries('drinking');
        /* Initialization is complete, so make the body's content visible */
        $('body').css('visibility', 'visible');
    }
});

function resetBounds(wait) {
    setTimeout(function() {
        map.invalidateSize({
            animate: true,
            easeLinearity: 0.7
        });
    }, wait);
}

function distance(x1, y1, x2, y2) {
    return Math.sqrt(((x2 - x1) ** 2) + ((y2 - y1) ** 2));
}

function hoverLock() {
    hoverEnabled = false;
    let delta = 0;
    let prevEvent;
    $('body').on('mousemove', function(e) {
        if (!!prevEvent) delta += distance(prevEvent.pageX, prevEvent.pageY, e.pageX, e.pageY);
        if (delta > 300) {
            hoverEnabled = true;
            $('body').off('mousemove');
        } else prevEvent = e;
    });
}

/* Function sorting arrays by values in nested arrays (e.g. [[key1,value1],[key2,value2]]) */
function sortInArray(arr, invert) {
    /* Get the length of the input array */
    let iLength = arr.length;
    /* Create empty arrays to store the output array, "keys" in the input array, and "values" in the input array */
    let arrReturn = [];
    let keys = [];
    let values = [];
    /* For each element (nested array) in the input array, copy the "key" and "value" to their respective arrays */
    arr.forEach(i => {
        keys.push(i[0]);
        values.push(i[1]);
    });
    /* Make a deep copy of the values array */
    let valuesCopy = [...values];
    /* Sort the copy of the values array in ascending or descending fashion, depending on the value of "invert" variable */
    let sorted = valuesCopy.sort(invert ? (a, b) => b - a : (a, b) => a - b);
    /* For each value in the sorted array: */
    sorted.forEach(i => {
        /* Get the index of this value in the input values */
        let index = values.indexOf(i);
        /* Add the "key" and "value" corresponding to this index to the output array */
        arrReturn.push([keys[index], values[index]]);
        /* Delete the "key" and "value" from their respective arrays */
        keys.splice(index, 1);
        values.splice(index, 1);
    });
    /* Return the output array */
    return arrReturn;
}

/* Function calculating a statistic for all of the values in an array */
function arrayStat(array, stat) {
    /* Initially set the sum of all values to zero */
    let sum = 0;
    /* For each value in the input array, add this amount to the sum */
    array.forEach(v => sum += v);
    /* If the desired statistic is the sum, return the sum */
    if (stat === 'sum') return sum;
    /* If the desired statistic is the mean, return the sum divided by the number of input values */
    else if (stat === 'mean') return sum / array.length;
}

/* Function adding the country features to the map */
function drawCountries(mode, event='click') {
    /* Store the selected display mode as the current display mode (this is to support hovering) */
    currentMode = mode;
    /* If the event that triggered this function was a click, store the selected display mode as the active display mode */
    if (event === 'click') activeMode = mode;
    /* If the event was a mouseout (end of hover), revert the mode back to the one selected by a click */
    else if (event === 'mouseout') mode = activeMode;
    /* For all chart tiles (rectangles bounding the charts), remove the "active" class (the class that causes a lighter background) */
    $('.chart-tile').removeClass('active');
    /* Add the "active" class to this display mode's chart tile */
    $(`#${mode}-chart`).addClass('active');
    /* Remove all country features from the map so they can be redrawn with the new colors */
    countries.clearLayers();
    /* Reset the countries layer, reloading the country data */
    countries = L.geoJSON(countryData, {
        /* For each feature in the layer, set the style: */
        style: function(feature) {
            /* Get the feature's properties */
            let p = feature.properties;
            return {
                /* If the feature's statistic for this theme is not null, use this theme's color ramp to determine the color; otherwise, use white */
                fill: (p[mode] !== null),
                fillColor: (p[mode] !== null ? themes[mode].scale(p[mode]) : null),
                /* Use this theme's opacity ramp to determine opacity */
                fillOpacity: themes[mode].opacity(p[mode]),
                /* Make the feature outlines black and very narrow */
                color: '#000',
                weight: 0.2
            };
        },
        /* For each feature in the layer, bind tooltips and event listeners: */
        onEachFeature: function(feature, layer) {
            /* Get the feature's properties */
            let p = feature.properties;
            /* When the feature is clicked on, hovered over, or no longer hovered over, call makeActive() with the feature's properties and the event's name */
            let timeout;
            layer
                .on('click', function() {
                    makeActive('country', p, 'click');
                })
                .on('mouseout', function() {
                    featureHoverActive = false;
                    clearTimeout(timeout);
                    layer.unbindTooltip();
                    setTimeout(() => {
                        if (!featureHoverActive) makeActive('country', p, 'mouseout');
                    }, 240);
                })
                .on('mouseover', function() {
                    featureHoverActive = true;
                    /* Bind a tooltip to the feature containing the country name, statistic name, statistic, and statistic description */
                    layer.bindTooltip(`
                        <p>${p.name}</p>
                        <p>${themes[mode].title}</p>
                        <div style="display:flex">
                            <p>${formatStat(p[mode], mode)}</p>
                            <p>${themes[mode].stat}</p>
                        </div>
                    `);
                    timeout = setTimeout(function() {
                        layer.openTooltip();
                        makeActive('country', p, 'mouseover');
                    }, 240);
                });
        }
    });
    /* Add the countries layer to the map if it isn't added already */
    countries.addTo(map);
}

/* Function properly formatting a statistic for a given theme */
function formatStat(stat, theme) {
    /* If the statistic has a null value, return "Unknown" text */
    if (stat === null) return 'Unknown ' + themes[theme].suffix;
    /* If the theme is mortality, round the statistic to one decimal point */
    else if (theme === 'mortality') return stat.toFixed(1);
    /* Otherwise, return the statistic with this theme's suffix */
    else return stat + themes[theme].suffix;
}

/* Function formatting integer currency values into a newspaper-style value */
function formatCurrency(v, precision) {
    /* If the input value is null, return "Unknown" text */
    if (v === null) return 'Unknown';
    /* Get the locale-formatted input value (i.e. add commas for digit grouping) */
    let styled = Math.round(v).toLocaleString('en-US');
    /* Get the first several characters of the locale-formatted value, replacing the comma with a decimal point and prepending a dollar sign */
    let first = '$' + Number(styled.slice(0, precision + 1).replace(',', '.'));
    /* Count the number of commas in the locale-formatted value */
    let commas = (styled.match(/,/g) || []).length;
    /* If the number of commas is 4 (the number is in the trillions), append a "T" to the output */
    if (commas === 4) return first + 'T';
    /* For billions, add "B" */
    else if (commas === 3) return first + 'B';
    /* For millions, add "M" */
    else if (commas === 2) return first + 'M';
    /* For thousands, add "K" */
    else if (commas === 1) return first + 'K';
    /* Otherwise, just return the straight-up value without any abbreviation */
    else return '$' + styled;
}

/* Function handling pointer events on chart bars */
function makeActiveD3(d) {
    /* Get the pointer event */
    let event = d3.event;
    /* Call makeActive() with this country's properties and this pointer event */
    if (event.type === 'click') makeActive('country', d.properties, event.type);
    /* Get the current theme's properties */
    let p = themes[currentMode];
    /* If a hover triggered this function: */
    if (event.type === 'mouseover' && hoverEnabled) {
        featureHoverActive = true;
        setTimeout(function() {
            if ($(event.target).filter(':hover').length > 0) {
                /* Call makeActive() with this country's properties and this pointer event */
                makeActive('country', d.properties, 'mouseover');
                /* Set the chart tooltip's content to contain the country name, statistic name, statistic, and statistic description */
                $('#chart-tooltip')
                    .html(`
                        <div class="leaflet-tooltip">
                            <p>${d.properties.name}</p>
                            <p>${p.title}</p>
                            <div style="display:flex">
                                <p>${formatStat(d.properties[currentMode], currentMode)}</p>
                                <p>${p.stat}</p>
                            </div>
                        </div>
                    `)
                    /* Make the tooltip visible and position it to be near the cursor */
                    .css('visibility', 'visible')
                    .css('top', (event.pageY - 30) + 'px')
                    .css('left', (event.pageX + 10) + 'px');
            }
        }, 240);
    /* If the end of a hover triggered this function, hide the tooltip: */
    } else if (event.type === 'mouseout') {
        featureHoverActive = false;
        /* Call makeActive() with this country's properties and this pointer event */
        setTimeout(() => {
            if (!featureHoverActive) makeActive('country', d.properties, 'mouseout');
        }, 240);
        $('#chart-tooltip').css('visibility', 'hidden');
    }
}

/* Function getting all properties for a region or country if only its name is provided */
function getProp(name, type) {
    /* For each feature in the data in question ("region" or "country"): */
    for (i = 0; i < window[type + 'Data'].features.length; i++) {
        /* If the provided region/country name matches the name of this feature, return this feature's properties */
        if (window[type + 'Data'].features[i].properties.name === name) return window[type + 'Data'].features[i].properties;
    }
}

/* Function making a feature active (i.e. drawing a thick outline around it, showing its statistics in the info box, and coloring the charts appropriately) */
function makeActive(type, prop, event) {
    /* If no feature properties have been provided, i.e. only a region or country name has been provided, get the feature's properties */
    if (typeof prop === 'string') prop = getProp(prop, type);
    /* If the event triggering this function was the end of a hover: */
    if (event === 'mouseout') {
        /* If there was an active feature stored by a previous click, use that feature's properties in the remainder of this function */
        if (!!activeFeature) {
            type = activeFeature.type;
            prop = activeFeature.prop;
        /* Otherwise, call removeActive() and stop this function */
        } else {
            removeActive();
            return;
        }
    }
    /* Remove all features from the "active" layer */
    active.clearLayers();
    /* Add the "inactive" class to all chart bars, causing them to become partially transparent */
    $('.bar').addClass('inactive');
    /* Reset the active layer, reloading the country or region data */
    active = L.geoJSON(window[type + 'Data'], {
        /* Disable interactivity on this layer, allowing pointer events to make it "down" to the underlying countries layer */
        interactive: false,
        /* Show only the feature with a name that matches the name in the provided active feature's properties */
        filter: feature => feature.properties.name === prop.name,
        style: {
            /* Don't fill the polygon */
            fill: false,
            /* Use a black and thick outline */
            color: '#000',
            weight: 3
        }
    });
    /* Add the "active" layer to the map if it isn't added already */
    active.addTo(map);
    /* Set the header of the info box to be the active feature's name */
    $('#info-title').html(prop.name);
    /* Hide all elements in the "stat" class */
    $('.stat').hide();
    /* Show elements that are in both the "stat" class and the type of feature's ("country" or "region") class */
    $('.stat.' + type).show();
    $('.stats').not(`#${type}-stats`).slideUp(300);
    $(`#${type}-stats`).slideDown(300);
    /* If the type of feature is country: */
    if (type === 'country') {
        /* For chart bars in the class with the same name as this country's abbreviation, remove the "inactive" class, restoring their full opacity */
        $('.' + prop.abbr).removeClass('inactive');
        /* For each theme, add the active feature's statistic for this theme to the info box */
        $.each(themes, theme => $(`#${theme}-stat`).html(formatStat(prop[theme], theme)));
    /* If the type of feature is region: */
    } else if (type === 'region') {
        /* For each country in this region, remove the "inactive" class from chart bars that are in the class with the same name as this country's abbreviation */
        prop.countries.forEach(abbr => $('.' + abbr).removeClass('inactive'));
        /* For each theme: */
        $.each(themes, theme => {
            /* Empty the country list in the info box for this theme */
            $(`#${theme}-list`).html(null);
            /* For each country in this theme and this region: */
            $.each(themes[theme][prop.name], (i, v) => {
                /* Append the country to this theme's country list, including the country's name, the statistic for this theme, and an event listener that makes this country active on click */
                $(`#${theme}-list`).append(`
                    <div class="region-list-entry" onclick="makeActive('country', '${v[0]}', 'click')">
                        <p>${v[0]}</p>
                        <p>${formatStat(v[1], theme).replace('Unknown', '&mdash;').replace(' %', '')}</p>
                    </div>
                `);
            });
        });
    }
    /* For each contextual statistic in the info box: */
    $.each(contextStats, stat => {
        /* If this statistic is the region, write the value straight to the info box without alteration */
        if (stat === 'region') $(`#${stat}-stat`).html(prop[stat]);
        /* If this statistic is the FSI, round to one decimal point before writing to the info box */
        else if (stat === 'fsi') $(`#${stat}-stat`).html(prop[stat].toFixed(1));
        /* Otherwise, this statistic is money-related and should be formatted as currency before writing to the info box */
        else $(`#${stat}-stat`).html(formatCurrency(prop[stat], 3));
    });
    /* If the event that triggered this function was a click: */
    if (event === 'click') {
        /* Show the info box */
        $('#info').slideDown(300);
        /* Invalidate the size of the map, causing it to rerender to accomodate the new size of the div it's in */
        resetBounds(300);
        /* Store the active feature's attributes for later use in lines 436-440 */
        activeFeature = {
            type: type,
            prop: prop
        };
        /* Zoom and pan the map to the active feature's extent */
        setTimeout(() => map.flyToBounds(active.getBounds()), 500);
    }
    /* Invalidate the size of the map, causing it to rerender to accomodate the new size of the div it's in */
    resetBounds(300);
}

/* When the region selector is changed: */
$('#region-select').on('change', function() {
    hoverLock();
    /* Make the selected region active */
    makeActive('region', $(this).val(), 'click');
    /* Reset the region selector's text to the initial value */
    $(this).val('Go to a region...');
});

/* Functing removing any active features */
function removeActive() {
    /* Set the active feature to be null */
    activeFeature = null;
    /* Remove the active feature from the "active" layer */
    active.clearLayers();
    /* Remove the "inactive" class from all DOM elements currently in the class, removing any transparenecy effect on chart bars */
    $('.inactive').removeClass('inactive');
    /* Hide the info box */
    $('#info').slideUp(300);
    /* Invalidate the size of the map, causing it to rerender to accomodate the new size of the div it's in */
    resetBounds(300);
}

/* When the info box's close button is clicked, call removeActive() */
$('#close').on('click', function() {
    removeActive();
});