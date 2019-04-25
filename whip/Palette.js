
import { Easing } from './Easing.js';

const Palette = function(paletteName, lineShape){

	var that = this;

	this.palettes = {
		bleuVertOrange: function(iteration ) {

            var _return = {
				h : 90 * that.lineShape.getEasing(1,iteration)-20,
				s : 50,
				//s : 50 + 25 * that.lineShape.getEasing(1,iteration*6),
				l : 50,
				transparency : 0.0835
				//transparency : 1
			};
            return _.extend(_return,that.hslToRgb(_return));
		},
		test: function(iteration){
            var _return = {
				h : 90 * that.lineShape.getEasing(1,iteration)+80,
				s : 60,
				l : 50,
				transparency : 0.535
				//transparency : 1
			};
            return _.extend(_return,that.hslToRgb(_return));
		},
		orangeDark: function(iteration){
            var _return = {
				h : 20 * that.lineShape.getEasing(1,iteration)+350,
				s : 65,
				l : 50,
				/*s : 65 + 5 * that.lineShape.getEasing(1,iteration*6),
				l : 50 - 5 * that.lineShape.getEasing(1,iteration*8),*/
				transparency : 0.535
				//transparency : 1
			};
            return _.extend(_return,that.hslToRgb(_return));
		},
		mega: function(iteration){
            var _return = {
				h : 360 * that.lineShape.getEasing(1,iteration),
				s : 85,
				l : 65,
				/*s : 85 + 5 * that.lineShape.getEasing(1,iteration*6),
				l : 65 + 10 * that.lineShape.getEasing(1,iteration*4),*/
				transparency : 0.535
				//transparency : 1
			};
            return _.extend(_return,that.hslToRgb(_return));
		},
	};

	this.paletteName = (_.isUndefined(paletteName) || _.isUndefined(this.palettes[paletteName]) ) ? 'bleuVertOrange' : paletteName;
	this.lineShape   = lineShape || new Easing();

	this.hslToRgb = function (color) {

		var r, g, b, m, c, x,
		    h = color.h,
            s = color.s,
            l = color.l;

		if (!isFinite(h)) h = 0
		if (!isFinite(s)) s = 0
		if (!isFinite(l)) l = 0

		h /= 60
		if (h < 0) h = 6 - (-h % 6)
		h %= 6

		s = Math.max(0, Math.min(1, s / 100))
		l = Math.max(0, Math.min(1, l / 100))

		c = (1 - Math.abs((2 * l) - 1)) * s
		x = c * (1 - Math.abs((h % 2) - 1))

		if (h < 1) {
			r = c
			g = x
			b = 0
		} else if (h < 2) {
			r = x
			g = c
			b = 0
		} else if (h < 3) {
			r = 0
			g = c
			b = x
		} else if (h < 4) {
			r = 0
			g = x
			b = c
		} else if (h < 5) {
			r = x
			g = 0
			b = c
		} else {
			r = c
			g = 0
			b = x
		}

		m = l - c / 2
		r = Math.round((r + m) * 255)
		g = Math.round((g + m) * 255)
		b = Math.round((b + m) * 255)

		return { r: r, g: g, b: b }
	}

};

Palette.prototype.getColor = function(iteration) { // iteration 0 to 1
	return this.palettes[this.paletteName](iteration);
};

Palette.prototype.setLineShape = function(lineShape) { // iteration 0 to 1
	this.lineShape = lineShape || new Easing();
	return this;
};




var colorToHex = function(color,inString = false) {

	var componentToHex = function(c) {
		var hex = c.toString(16);
		return hex.length == 1 ? "0" + hex : hex;
	},
	str = '000000';

	if (_.isUndefined(color)) {
		return str;
	}

    str = componentToHex(color.r) + componentToHex(color.g) + componentToHex(color.b);

    if (inString) {
        return str;
    }

    return parseInt('0x' + str);
};

export {Palette, colorToHex};