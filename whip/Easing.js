// --------------------------  -------------------------- //
const startingTime = new Date().getTime();

// AIE EN double!!!!!! FAUX !!!!!!
const globals = {
	factorTime : 100,
	reactAngle: 0.05,
};

const Easing = function(options){
	var that = this,
		time   = (new Date().getTime() - startingTime)  / globals.factorTime;;
	this.nbPeriod          = !_.isUndefined(options) && !_.isUndefined(options.nbPeriod) ? options.nbPeriod : 1;
	this.name              = !_.isUndefined(options) && !_.isUndefined(options.name) ? options.name : 'linear';
	this.injectedEasingDef = !_.isUndefined(options) ? options.injectedEasingDef : undefined;
	this.injectedEasing    = !_.isUndefined(this.injectedEasingDef) ? new Easing(options.injectedEasingDef) : function(){return 1};

	this.easings = {
		linear : function(width, iteration) {
			iteration = iteration - 0.00001;
			return width * (1 - (iteration % (1/that.nbPeriod)) * that.nbPeriod * that.injectedEasing(1,iteration));
		},
		worm : function(width, iteration) {
			return width * (Math.sin(iteration * Math.PI * that.nbPeriod * that.injectedEasing(1,iteration))/3+1);
		},
		sansueBigHead : function(width, iteration) {
			return width * (
			  Math.sin( iteration * Math.PI * 1.5 * that.nbPeriod * that.injectedEasing(1,iteration)) + 1
			);
		},
		sansue : function(width, iteration) {
			return width * (
			  Math.sin( (-0.5 + iteration * Math.PI * 1.5) * that.nbPeriod * that.injectedEasing(1,iteration)) + 1
			);
		},
		virgule : function(width, iteration) {
			return width * (
			  Math.cos(iteration * Math.PI * that.nbPeriod * that.injectedEasing(1,iteration)) + 1
			);
		},
		vibrant : function(width, iteration) {
			return (width + (width * (0.5 - Math.random()) * 2 * that.injectedEasing(1,iteration)))/2;
		},
		ondule : function(width, iteration) {
			return Math.abs((Math.sin(time/4 + ((1-iteration) * Math.PI * that.nbPeriod * 2))) * width * (2-iteration)) ;
		},
		combo : function(width, iteration) {
			// return  width * (
				  // new Easing().virgule(1,iteration) *
				  // new Easing({nbPeriod:16}).worm(1,iteration ) *
				  // that.injectedEasing(1,iteration)
				// );
				return  width * (
				  new Easing({name:'virgule',nbPeriod:1 *that.nbPeriod }).getEasing(1,iteration) /2 +
				  new Easing({name:'worm', nbPeriod:17 * that.nbPeriod}).getEasing(1,iteration )
				);
		},
		comboVibran : function(width, iteration) {
			// return  width * (
				  // new Easing().virgule(1,iteration) *
				  // new Easing({nbPeriod:16}).worm(1,iteration ) *
				  // that.injectedEasing(1,iteration)
				// );
				return  width * (
				  new Easing({name:'virgule',nbPeriod:1 *that.nbPeriod }).getEasing(1,iteration) *2 +
				  new Easing({name:'worm', nbPeriod:17 * that.nbPeriod}).getEasing(1,iteration )  +
				  new Easing({name:'ondule', nbPeriod:1 * that.nbPeriod}).getEasing(1,iteration ) / 4
				);
		},
		comboVibran2 : function(width, iteration) {
			// return  width * (
				  // new Easing().virgule(1,iteration) *
				  // new Easing({nbPeriod:16}).worm(1,iteration ) *
				  // that.injectedEasing(1,iteration)
				// );
				return  width * (
				  new Easing({name:'virgule',nbPeriod:1 *that.nbPeriod }).getEasing(1,iteration) /2 +
				  new Easing({name:'worm', nbPeriod:17 * that.nbPeriod}).getEasing(1,iteration )  +
				  new Easing({name:'ondule', nbPeriod:1 * that.nbPeriod}).getEasing(1,iteration ) / 4
				);
		},
		bloby : function(width, iteration) {
			return width * (Math.sin(iteration)/3+1);
		}
	};

	return this;
};

Easing.prototype.getEasing = function(width, iteration) { // iteration 0 to 1
	return this.easings[this.name](width, iteration);
};

export {Easing};