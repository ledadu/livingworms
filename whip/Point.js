// -------------------------- point -------------------------- //

const Point = function(options) {
		this.x = !_.isUndefined(options.x) ? options.x : 0;
		this.y = !_.isUndefined(options.y) ? options.y : 0;
}

Point.prototype.add = function( v ) {
  this.x += v.x;
  this.y += v.y;
  return this;
};

Point.prototype.subtract = function( v ) {
  this.x -= v.x;
  this.y -= v.y;
  return this;
};

Point.add = function( a, b ) {
  return new Point( {x: a.x + b.x, y: a.y + b.y} );
};

Point.prototype.scale = function( s )  {
  this.x *= s;
  this.y *= s;
  return this;
};

Point.prototype.copy = function() {
  return new Point({x: this.x, y: this.y} );
};

Point.getDistance = function( a, b ) {
  var dx = a.x - b.x;
  var dy = a.y - b.y;
  return Math.sqrt( dx * dx + dy * dy );
};

Point.addDistance = function( point, distance, angle ) {
  var x = point.x + Math.cos( angle ) * distance || 0;
  var y = point.y + Math.sin( angle ) * distance || 0;
  return new Point({ x:x, y:y });
};

// ----- utils ----- //

const getAngle = function( a, b ) {
  return Math.atan2( b.y - a.y, b.x - a.x );
}

export {Point, getAngle}