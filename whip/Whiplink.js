// -------------------------- WhipLink -------------------------- //

import { Point, getAngle } from './Point.js';

const WhipLink = function ( props ) {
  this.whip			 = props.whip;
  this.layerIndex    = props.layerIndex;
  this.particleA     = props.particleA;
  this.particleB     = props.particleB;
  this.maxLength     = props.maxLength;
  this.minLength     = props.minLength | 0;
  this.deltaScale    = props.deltaScale;
  this.angleRotation = props.angleRotation || 0;
  this.angleFixed    = props.angleFixed || null;
  this.angle         = null;
}

WhipLink.prototype.update = function() {

	// this.particleA.p
	// this.particleA.update();
	this.particleB.update();
	this.constrainParticles();
};

// constrain particles to size of SpringLever
WhipLink.prototype.constrainParticles = function() {
  var positionA = this.particleA.position;
  var positionB = this.particleB.position;
  var distance = Point.getDistance( positionA, positionB );
  this.angle = this.angleFixed || (this.angleRotation + getAngle( positionA, positionB ));
  if (  this.minLength <= distance && distance <= this.maxLength ) {
    return;
  }


  this.updateParticleBWhithAngle(this.angle);


};

WhipLink.prototype.updateParticleBWhithAngle = function(angle) {
	this.angle = angle;
	var positionA = this.particleA.position;
	var positionB = this.particleB.position;
	var newPosition = Point.addDistance( positionA, this.maxLength, this.angle );
	var delta = newPosition.copy().subtract(positionB) || 0;
	delta.scale( this.deltaScale )
	this.particleB.position.add( delta );
	this.particleB.previousPosition.add( delta );
	this.particleB.position = newPosition;

}


// --------------------------  -------------------------- //

WhipLink.prototype.render = function( ctx ) {
	if (this.whip.renderLinks) {
		/*
		ctx.lineWidth = this.particleA.size;
		line( ctx, this.particleA.position, this.particleB.position ,this.particleA.color);
		*/
		graphics.lineStyle(this.particleA.size, colorToHex(this.particleA.color), this.particleA.color.transparency);
		graphics.moveTo(this.particleA.position.x, this.particleA.position.y);
		graphics.lineTo(this.particleB.position.x, this.particleB.position.y);

	}

};

export {WhipLink};