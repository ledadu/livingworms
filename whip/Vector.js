import {Point} from './Point.js';

// -------------------------- vector -------------------------- //

const Vector = function(options) {
	//vector attributes
	this.x  = !_.isUndefined(options.x) ? options.x : null;
	this.y  = !_.isUndefined(options.y) ? options.y : null;
	this.a  = !_.isUndefined(options.a) ? options.a : null;
	this.b  = !_.isUndefined(options.b) ? options.b : null;

	if (_.isNull(this.x)) {
		this.x = this.b.x - this.a.x;
	}

	if (_.isNull(this.y)) {
		this.y = this.b.y - this.a.y;
	}

	//Unit vector attributes
	this.fu = null;
	this.xu = null;
	this.yu = null;
	this.au = null;
	this.bu = null;

}


Vector.prototype.getLength = function() {
    return Math.sqrt( this.x * this.x  + this.y * this.y );
};

Vector.prototype.equals = function ( v ) {
  return this.x == v.x && this.y == v.y;
};


Vector.prototype.block = function( size ) {
  this.x = Math.floor( this.x / size );
  this.y = Math.floor( this.y / size );
};

Vector.prototype.orthoRotate = function( options ) {
	var ax = (this.a.x  + this.a.y + this.b.x - this.b.y)/2,
		ay = (-this.a.x + this.a.y + this.b.x + this.b.y)/2,
		bx = (this.a.x  - this.a.y + this.b.x + this.b.y)/2,
		by = (this.a.x  + this.a.y - this.b.x + this.b.y)/2;

	this.a.x = ax;
	this.a.y = ay;
	this.b.x = bx;
	this.b.y = by;

	return this;
}

Vector.prototype.makeUnitVector = function( options ) {

	if (_.isNull(this.xu)) {

		var length = this.getLength(),
			offset = new Point({x:0, y:0});

		this.xu = (this.b.x - this.a.x) / length;
		this.yu = (this.b.y - this.a.y) / length;
		
		//Calculate offset center
		offset.x = (this.b.x - this.a.x)/2 - this.xu/2;
		offset.y = (this.b.y - this.a.y)/2 - this.yu/2;

		this.au = new Point({x: this.a.x + offset.x, y: this.a.y + offset.y});
		this.bu = new Point({x: this.b.x - offset.x, y: this.b.y - offset.y});

	}

	return this;

}



Vector.prototype.scaleFromUnit = function( options ) {

//return this.scale(options);

	this.makeUnitVector();

	var offset = new Point({x:0, y:0});

	this.x = this.b.x - this.a.x;
	this.y = this.b.y - this.a.y;

	//Calculate offset center
	offset.x = options.f * this.xu/2;
	offset.y = options.f * this.yu/2;

	var a = new Point({x: this.au.x - offset.x, y: this.au.y - offset.y});
	var b = new Point({x: this.bu.x + offset.x, y: this.bu.y + offset.y});

	this.a = a;
	this.b = b;

//todo store a.x ... better...
	this.x = this.b.x - this.a.x;
	this.y = this.b.y - this.a.y;

	return this;

}

Vector.prototype.scale = function( options ) {

	var offset = new Point({x:0, y:0});

	//WOOWWW !! :
	this.x = this.b.x - this.a.x;
	this.y = this.b.y - this.a.y;

	//Calculate offset center
	offset.x = options.f * this.x /2;
	offset.y = options.f * this.y /2;

	var a = new Point({x: this.a.x - offset.x, y: this.a.y - offset.y});
	var b = new Point({x: this.b.x + offset.x, y: this.b.y + offset.y});

	this.a = a;
	this.b = b;

//todo store a.x ... better...
	this.x = this.b.x - this.a.x;
	this.y = this.b.y - this.a.y;

	return this;

}

// ----- utils ----- //

const getAngle = function( a, b ) {
  return Math.atan2( b.y - a.y, b.x - a.x );
}

export {Vector, getAngle};