// -------------------------- Particle -------------------------- //
import {Point} from './Point.js';
import {Vector} from './Vector.js';

const gravity    = new Vector( {x: 0, y: 0/*.8*/} );

const Particle = function( props ) {
  this.whipLink = props.whipLink;
  this.layerIndex = props.layerIndex;
  this.position = new Point( {x: props.x, y: props.y} );
  this.previousPosition = new Point( {x: props.x, y: props.y });
  this.isPinned = props.isPinned;
  this.friction = props.friction;
  this.size = props.size;
  this.color = props.color;
  this.update();
}

Particle.prototype.update = function() {
  this.integrate();
};

Particle.prototype.integrate = function() {
  if ( this.isPinned ) {
    // this.previousPosition.set( this.position );
    return;
  }
  var velocity = this.position.copy().subtract(this.previousPosition );
  // friction
  velocity.scale( this.friction );
  this.previousPosition = this.position.copy();
  this.position.add( velocity );
  this.position.add( gravity );
};

// --------------------------  -------------------------- //

function zoomCtx(position,size,zoom){
  zoom = zoom || 1;
  return {
    x    : position.x / zoom,
    y    : position.y / zoom,
    size : size / zoom
  }
}

Particle.prototype.render = function( ctx ) {
	if (this.whipLink.whip.renderParticles) {
		var newPosition = zoomCtx(this.position,2,1);
			//circle = new PIXI.Circle (newPosition.x, newPosition.y, newPosition.size/4);


		graphics.beginFill(colorToHex(this.color), this.color.transparency);
		graphics.drawCircle(newPosition.x, newPosition.y, newPosition.size/4); // drawCircle(x, y, radius)
		graphics.endFill();

		//circle( ctx, newPosition.x, newPosition.y, newPosition.size/4 ,newPosition.color );

		// dot
		// ctx.fillStyle = 'hsla(0, 100%, 50%, 0.5)';
		// circle( this.position.x, this.position.y, 5  );
  }
};

export {Particle};