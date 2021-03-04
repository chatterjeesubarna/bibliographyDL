/**
 * @fileoverview An SVG circular scroller using D3.js
 * @author MooD International (Ian Wright & Tony Hales)
 * 
 * Originally based upon http://bl.ocks.org/mbostock/6452972
 */

namespace('mood.d3');

/**
 * An SVG based circular scroller
 * @constructor
 */
mood.d3.circularScroller = function () {

	//#region Private Variables

	let self = this; // The scroller that will be returned  
	let brush = null;       // Brush which is used on the scroller
	let sliderHandle = null; // Actual d3 selection for the slider handle
	let margin = { top: 0, left: 0, bottom: 0, right: 0 };
	let cssClass = '';
	let width = 10;
	let min = 0;
	let max = 100;
	let gapSize = 0;
	let currentValue = 0;
	let callback = function (scroller, value) { };
	let radius = 50;
	let target = null;
	let canBeRendered = false; // cannot render this scroller until we have been appended to a target
	let isScrolling = false; // only used to prevent rendering as the brush is being moved
	let page = 0;

	//#endregion

	//#region Public Property Methods

	/**
     * Changes the width of the scrollbar (pre initialization only)
     * @param {number} value The width that the scroller should be
     * @returns {number} The width that the scroller should take or the scroller itself
     */
	self.width = function (value) {
		if (!arguments.length) return width;
		if (typeof (value) !== "number") throw "Invalid argument type provided to width; expected an integer.";
		width = parseInt(value);
		return self;
	};	 

	/**
     * Changes the minimum value of the scroller (pre initialization only)
     * @param {number} value The minimum value that the scroller can take
     * @returns {number} The minimum value that the scroller can take or the scroller itself
     */
	self.min = function (value) {
		if (!arguments.length) return min;
		min = value;
		return self;
	};

	/**
     * Changes the maximum value of the scroller (pre initialization only)
     * @param {number} value The maximum value that the scroller can take
     * @returns {number} The maximum value that the scroller can take or the scroller
     */
	self.max = function (value) {
		if (!arguments.length) return max;
		max = value;
		return self;
	};

	/**
     * Changes the margin of the scroller (pre initialization only)
     * @param { object<left: number, right: number, top: number, bottom: number> } value The margin that the control should use (need to specify the left, top, bottom, right)
     * @returns {mood.d3.circularScroller} The margin that the scroller is using or the scroller
     */
	self.margin = function (value) {
		if (!arguments.length) return margin;
		if (typeof (value) !== "object") throw 'Invalid argument type provided for margin.';
		margin = value;
		return self;
	};

	/**
     * Changes the custom CSS class that should be attached to the scroller (pre initialization only)
     * @param {string} value The custom CSS class of the scroller
     * @returns {string} The current custom CSS class of the scroller or the scroller
     */
	self.cssClass = function (value) {
		if (!arguments.length) return cssClass;
		cssClass = value;
		return self;
	};

	/**
    * Changes the current value of the scroller
    * @param {number} value The new value of the scroller
    * @returns {number} The current value of the scroller or the scroller
    */
	self.value = function (value) {
		if (!arguments.length) return currentValue;
		value = isNaN(value) ? 0 : parseFloat(value); //ensure that the value is a float		
		if (value < min) value = min;
		if (value > max) value = max;
		if (value === currentValue) return;
		currentValue = value;
		return self;
	};

	/**
    * Changes the size of the gap at the top of the circular scroller
    * @param {number} value The size of the gap (in degrees)
    * @returns {number} The current value of the gap or the scroller
    */
	self.gapSize = function (value) {
		if (!arguments.length) return gapSize;
		value = isNaN(value) ? 0 : parseFloat(value); //ensure that the value is a float		
		if (value === gapSize) return;
		gapSize = value;
		return self;
	};

	/**
    * Changes the radius of the scroller
    * @param {number} value The new radius of the scroller
    * @returns {number} The current value of the scroller or the scroller
    */
	self.radius = function (value) {
		if (!arguments.length) return radius;
		radius = isNaN(value) ? 0 : parseFloat(value); //ensure that the value is a float
		return self;
	};

	/**
    * Changes the callback of the scroller, triggered when the value changes
    * @param {function} func The function to call that can take up to 2 parameters (scroller, value)
    * @returns {function} The current callback function
    */
	self.callback = function (func) {
		if (!arguments.length) return callback;
		callback = func;
		return self;
	};

	/**
     * Configures the scroller based on the given JavaScript object
     * which makes configuring a scroller from JSON much simpler.
     * @param {object} config A JavaScript object of properties
     * @returns {mood.d3.circularScroller} The scroller for method chaining
     */
	self.configure = function (config) {
		// ensure that we don't have an empty object
		config = config || {};

		if (typeof (config.width) === "number") { self.width(config.width); }
		if (typeof (config.min) === "number") { self.min(config.min); }
		if (typeof (config.max) === "number") { self.max(config.max); }
		if (typeof (config.value) === "number") { self.value(config.value); }
		if (typeof (config.radius) === "number") { self.radius(config.radius); }
		if (typeof (config.cssClass) === "string") { self.cssClass(config.cssClass); }
		if (typeof (config.margin) === "object") { self.margin(config.margin); }
		if (typeof (config.callback) === "function") { self.callback(config.callback); }
		if (typeof (config.gapSize) === "number") { self.gapSize(config.gapSize); }
		if (config.target) { self.appendTo(config.target); }

		return self;
	};

	/**
     * Appends the _self to the DOM underneath the given target
     * @param {selector} target Either a D3 object or a string selector to locate the DOM element to insert into. Must be an SVG element, or child of an SVG element
     * @returns {mood.d3.circularScrollbar} This scroller
     */
	self.appendTo = function (value) {
		target = d3.select(value)
			.append('g')
			.attr('data-role', 'circularScroller');
		canBeRendered = true;
		return self;
	}

	//#endregion

	//#region Public Methods


	/**
	 * Remove scroller from the DOM 
	 */
	self.dispose = function () {		
		d3.select('[data-role=circularScroller]').remove();
	}

	/**
	 * Render this scroller within the provided target, if no target has been provided (through appendTo) then no rendering is performed.
	 * Can only render once, once it has been rendered for the first time, subsequent calls are ignored.
	 */
	self.render = function () {
		
		if (!canBeRendered) return; // if we haven't yet been appended to a target, we can't be drawn
		if (isScrolling) return;

		let gapAtTopOfScroller = gapSize * (Math.PI / 180);
		let startAngle = gapAtTopOfScroller / 2;
		let endAngle = (2 * Math.PI) - (gapAtTopOfScroller / 2);		

		// Create the arc
		let arc = d3.svg.arc()
			.innerRadius(radius)
			.outerRadius(radius + width)
			.startAngle(startAngle)
			.endAngle(endAngle);

		backgroundSelection = target.select('path.background');
		if (backgroundSelection.empty()) { backgroundSelection = target.append('path').attr('class', 'background'); }

		backgroundSelection
			.attr("transform", "translate(" + margin.left + ", " + margin.top + ")")
			.attr("d", arc);

		// Create the brush
		if (!brush) {
			brush = d3.svg.circularbrush()
				.angles(startAngle, endAngle)
				.range([min, max + 1])
				.extent([0, 1])
				.tolerance(0.5)
				.innerRadius(radius)
				.outerRadius(radius + width)
				.on("brushstart", function () { isScrolling = true; })
				.on("brush", brushed)
				.on("brushend", function () { isScrolling = false; });

			sliderHandle = target
				.call(brush)
				.select("g.circularbrush")
				.attr("transform", "translate(" + margin.left + ", " + margin.top + ")");
		} else {
			brush.extent([currentValue, currentValue + 1]);
			brush.range([min, max + 1]);
			brush.redraw();
		}

		//sliderHandle = target.select("g.circularbrush");

		//hasBeenRendered = true; // Flag that we have now been rendered

		return self;
	};

	//#endregion

	//#region Internal Methods

	/**
     * When the scroller changes it's value by having the scroller dragged
     * then calculate the new value and trigger an update/callback
     */
	function brushed() {
		let data = [];
		for (let index = 0; index <= max; index++) { data[index] = index; }
		let filteredData = brush.filter(data, function (item) { return item; });
		if (filteredData.length === 0) filteredData = brush.filter(data, function (item) { return item; });
		value = filteredData[0] // the first value since the extent is always just one, we should only ever have one in the filtered data
		
		if (typeof (callback) === 'function') callback(self, value);
	};

	//#endregion	

};