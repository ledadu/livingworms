// ----- utils ----- //

function getAngle( a, b ) {
  return Math.atan2( b.y - a.y, b.x - a.x );
}


// -------------------------- vector -------------------------- //

function Vector( x, y ) {
  this.x = x || 0;
  this.y = y || 0;
}

Vector.prototype.set = function( v ) {
  this.x = v.x;
  this.y = v.y;
};

Vector.prototype.add = function( v ) {
  this.x += v.x;
  this.y += v.y;
};

Vector.prototype.subtract = function( v ) {
  this.x -= v.x;
  this.y -= v.y;
};

Vector.prototype.scale = function( s )  {
  this.x *= s;
  this.y *= s;
};

Vector.prototype.multiply = function( v ) {
  this.x *= v.x;
  this.y *= v.y;
};

// custom getter whaaaaaaat
Object.defineProperty( Vector.prototype, 'magnitude', {
  get: function() {
    return Math.sqrt( this.x * this.x  + this.y * this.y );
  }
});

Vector.prototype.equals = function ( v ) {
  return this.x == v.x && this.y == v.y;
};

Vector.prototype.zero = function() {
  this.x = 0;
  this.y = 0;
};

Vector.prototype.block = function( size ) {
  this.x = Math.floor( this.x / size );
  this.y = Math.floor( this.y / size );
};

// ----- class functions ----- //
// return new vectors

Vector.subtract = function( a, b ) {
  return new Vector( a.x - b.x, a.y - b.y );
};

Vector.add = function( a, b ) {
  return new Vector( a.x + b.x, a.y + b.y );
};

Vector.copy = function( v ) {
  return new Vector( v.x, v.y );
};

Vector.isSame = function( a, b ) {
  return a.x == b.x && a.y == b.y;
};

Vector.getDistance = function( a, b ) {
  var dx = a.x - b.x;
  var dy = a.y - b.y;
  return Math.sqrt( dx * dx + dy * dy );
};

Vector.addDistance = function( vector, distance, angle ) {
  var x = vector.x + Math.cos( angle ) * distance;
  var y = vector.y + Math.sin( angle ) * distance;
  return new Vector( x, y );
};

// --------------------------  -------------------------- //

// -------------------------- Particle -------------------------- //


function Particle( x, y, friction, isPinned ) {
  this.position = new Vector( x, y );
  this.previousPosition = new Vector( x, y );
  this.isPinned = isPinned;
  this.friction = friction;
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
  var velocity = Vector.subtract( this.position, this.previousPosition );
  // friction
  velocity.scale( this.friction );
  this.previousPosition = Vector.copy( this.position );
  this.position.add( velocity );
  this.position.add( gravity );
};

// --------------------------  -------------------------- //

Particle.prototype.render = function( ctx ) {
  // big circle
  circle( ctx, this.position.x, this.position.y, 2 ,'rgba(0%, 100%, 0%, 1)' );
  // dot
  // ctx.fillStyle = 'hsla(0, 100%, 50%, 0.5)';
  // circle( this.position.x, this.position.y, 5  );
};

function circle( ctx, x, y, radius , fillStyle = '#000') {
  if(radius <= 0){
	 return; 
  }
  ctx.beginPath();
  ctx.arc( x, y, radius, 0, Math.PI * 2 );
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.closePath();
}

// -------------------------- WhipLink -------------------------- //

function WhipLink( props ) {
  this.particleA = props.particleA;
  this.particleB = props.particleB;
  this.maxLength = props.maxLength;
  this.deltaScale = props.deltaScale;
  this.angleRotation = props.angleRotation;
  this.lastAngle  = null;
  this.angleMax   = props.angleMax;
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
  var distance = Vector.getDistance( positionA, positionB );
  if ( distance <= this.maxLength ) {
    return;
  }
  var angle = getAngle( positionA, positionB );
  if(! _.isUndefined(this.angleRotation)){
	  angle += this.angleRotation;
  }
 
  var newPosition = Vector.addDistance( positionA, this.maxLength, angle );
  var delta = Vector.subtract( newPosition, positionB );
  delta.scale( this.deltaScale )
  this.particleB.position.add( delta );
  this.particleB.previousPosition.add( delta );
  this.particleB.position = newPosition;
  
};

// --------------------------  -------------------------- //

WhipLink.prototype.render = function( ctx ) {


  //ctx.lineWidth = 8;
  //line( ctx, this.particleA.position, this.particleB.position );
  
  circle( ctx, this.particleA.position.x,this.particleA.position.y, 4 ,'rgba(100%, 0%, 0%, 1)' );

};

function line( ctx, a, b , strokeStyle = 'rgba(100%, 0%, 00%, 1)') {
  ctx.beginPath();
  ctx.strokeStyle = strokeStyle;
  ctx.moveTo( a.x, a.y );
  ctx.lineTo( b.x, b.y );
  ctx.stroke();
  ctx.closePath();
}




// -------------------------- whip -------------------------- //

function Whip( props ) {
  
  this.linkCount       = props.linkCount;
  this.width           = props.width;
  this.lineShape       = props.lineShape || new Easing().linear;
  this.friction        = props.friction || 0.85;
  this.deltaScale      = props.deltaScale || 0.85;
  this.renderParticles = props.renderParticles || false;
  this.renderLinks     = props.renderLinks || false;
  this.subWhips		   = props.subWhips || []; 
  this.angleRotation   = props.angleRotation || 0 ;

  this.links = [];

  for ( var i=0; i <= props.linkCount; i++ ) {
    var particleA = i === 0 ? new Particle( props.x, props.y, this.friction, true ) :
    this.links[ i - 1 ].particleB;
    this.links[i] = new WhipLink({
      particleA: particleA,
      particleB: new Particle( props.x, props.y, this.friction ),
      maxLength: props.maxLinkLength,
	  deltaScale: props.deltaScale,
	  angleRotation : (i <= props.linkCount) ? (this.angleRotation * (props.linkCount-i)/props.linkCount ) : 0,
	  angleMax  : (Math.PI / 4)	// TODO !!
    });
  }
}

Whip.prototype.update = function() {
	
	var that = this;
	for ( var i=0, len = this.links.length; i < len; i++ ) {
		this.links[i].update();	
	}
	this.subWhips.forEach(function(subWhip){
		subWhip.whip.links[0].particleA.position.x = that.links[subWhip.attachNum].particleA.position.x;
		subWhip.whip.links[0].particleA.position.y = that.links[subWhip.attachNum].particleA.position.y;
		subWhip.whip.update();
	});
};

Whip.prototype.render = function( ctx ) {
	var position = this.links[0].particleA.position;
	circle( ctx, position.x, position.y ,this.lineShape(this.width, 0 ), 'rgba(100%, 100%, 50%, 0.01)' ); 
	for ( var i=0, len = this.links.length; i < len; i++ ) {
		var link = this.links[i];
	
		position = link.particleB.position;
		//ctx.lineTo( position.x, position.y );
		var r =  100 *  this.lineShape(1,i/this.linkCount * 3.1 ),
			g =  100 *  this.lineShape(1,i/this.linkCount * 2.5 ),
			b =  100 *  this.lineShape(1,i/this.linkCount * 2.2 ),
		
			transparency = 0.0835;// * new Easing().combo(1,i/this.linkCount/4);
	
	//console.log('hsla(' + r  + ', ' + b + ', ' + b + ', 0.01)' );
		circle( ctx, position.x, position.y , this.lineShape(this.width, i / this.linkCount ),  'rgba(' + r + '%, ' + g + '%, ' + b + '%, ' + transparency + ')'  ); 
	}
	if(this.renderLinks){
		this.links.forEach(function(link) {
			link.render(ctx);
		});  
	}
  
	if(this.renderParticles){
		this.links.forEach(function(link) {
			link.particleA.render(ctx);
		});  
	}
	  
  
};


// --------------------------  -------------------------- //

var Easing = function(options){
	var that = this;
	this.nbPeriod       = !_.isUndefined(options) && !_.isUndefined(options.nbPeriod)? options.nbPeriod : 1;
	this.injectedEasing = !_.isUndefined(options) && !_.isUndefined(options.injectedEasing) ? options.injectedEasing : function(){return 1};
	
  
	this.linear = function(width, iteration) {  
		// console.log(that.nbPeriod);
		iteration = iteration - 0.00001;
		return width * (1 - (iteration % (1/that.nbPeriod)) * that.nbPeriod * that.injectedEasing(1,iteration));
	};
	
	this.worm = function(width, iteration) {  
		return width * (Math.sin(iteration * Math.PI * that.nbPeriod * that.injectedEasing(1,iteration))/3+1);
	};
	
	this.sansueBigHead = function(width, iteration) {  
		return width * (
		  Math.sin( iteration * Math.PI * 1.5 * that.nbPeriod * that.injectedEasing(1,iteration)) + 1
		);
	};
	
	this.sansue = function(width, iteration) {  
		return width * (
		  Math.sin( (-0.5 + iteration * Math.PI * 1.5) * that.nbPeriod * that.injectedEasing(1,iteration)) + 1
		);
	};
	
	this.virgule = function(width, iteration) {  
		return width * (
		  Math.cos(iteration * Math.PI * that.nbPeriod * that.injectedEasing(1,iteration)) + 1
		);
	};
	
	this.vibrant = function(width, iteration) {
		return (width + (width * (0.5 - Math.random()) * 2 * that.injectedEasing(1,iteration)))/2;
	};
	
	/// combo Easing ///
	
	this.combo = function(width, iteration) {  
		// return  width * (
			  // new Easing().virgule(1,iteration) *
			  // new Easing({nbPeriod:16}).worm(1,iteration ) *
			  // that.injectedEasing(1,iteration)
			// );
			return  width * (
			  new Easing().virgule(1,iteration) /2 +
			  new Easing({nbPeriod:17}).worm(1,iteration )  
			);
	}
	return this;
  
};


var bloby = function(width, iteration) {  
  return width * (Math.sin(iteration)/3+1);
}

var canvas = null;
var ctx = null;
var w = 0;
var h = 0;
var img=new Image();

$(document).ready(function() {
	canvas = $('canvas').get(0);
	w = canvas.width = window.innerWidth - 20;
	h = canvas.height = window.innerHeight - 20;
	ctx = canvas.getContext('2d');
	
	 canvas.addEventListener( 'mousedown', onMousedown, false );
	  var rect = canvas.getBoundingClientRect();
	  canvasOffsetLeft = rect.left;
	  canvasOffsetTop = rect.top;
	  console.log('start');	  
	  
    img.onload=function(){
        ctx.drawImage(img,0,0,img.width,img.height,0,0,w,h);
    }
    img.src="http://static9.depositphotos.com/1001311/1123/i/950/depositphotos_11236001-The-brown-wood-texture-with-natural-patterns.jpg";
	  

	  start();
});


var gravity    = new Vector( 0, 0/*.8*/ );
var friction   = 0.85;
var deltaScale = {
	normal : 0.85,
	speed  : 0.6,
};

var whips = [];

whips.push(
	new Whip({
		x: 100,
		y: 100,
		linkCount: 60,
		maxLinkLength: 20,
		width: 80,
		friction: 0.7,
		deltaScale: deltaScale.speed,
		// lineShape: new Easing({nbPeriod:4, injectedEasing:new Easing({nbPeriod:16}).linear}).combo,
		lineShape: new Easing({nbPeriod:1}).sansue,
	})
);

whips.push(
	new Whip({
		x: 100,
		y: 100,
		linkCount: 1200,
		maxLinkLength: 2,
		width: 20,
		friction: 0.7,
		deltaScale: deltaScale.speed,
		// lineShape: new Easing({nbPeriod:4, injectedEasing:new Easing({nbPeriod:16}).linear}).combo,
		lineShape: new Easing({nbPeriod:1}).combo,
		subWhips: [
				{
					attachNum : 900,
					whip: new Whip({
						x: 1100,
						y: 1150,
						linkCount: 600,
						maxLinkLength:1,
						width: 4,
						friction: friction + 0.085,
						deltaScale: deltaScale.normal,
						lineShape: new Easing({nbPeriod:1}).virgule,
						angleRotation: Math.PI /60
					})
				},
				{
					attachNum : 900,
					whip:new Whip({
						x: 1100,
						y: 1150,
						linkCount: 600,
						maxLinkLength:1,
						width: 4,
						friction: friction + 0.085,
						deltaScale: deltaScale.normal,
						lineShape: new Easing({nbPeriod:1}).virgule,
						angleRotation: -Math.PI /60
					})
				},
				{
					attachNum : 600,
					whip: new Whip({
						x: 1100,
						y: 1150,
						linkCount: 600,
						maxLinkLength:1,
						width: 4,
						friction: friction + 0.085,
						deltaScale: deltaScale.normal,
						lineShape: new Easing({nbPeriod:1}).virgule,
						angleRotation: Math.PI /60
					})
				},
				{
					attachNum : 600,
					whip:new Whip({
						x: 1100,
						y: 1150,
						linkCount: 600,
						maxLinkLength:1,
						width: 4,
						friction: friction + 0.085,
						deltaScale: deltaScale.normal,
						lineShape: new Easing({nbPeriod:1}).virgule,
						angleRotation: -Math.PI /60
					})
				},{
					attachNum : 300,
					whip: new Whip({
						x: 1100,
						y: 1150,
						linkCount: 600,
						maxLinkLength:1,
						width: 4,
						friction: friction + 0.085,
						deltaScale: deltaScale.normal,
						lineShape: new Easing({nbPeriod:1}).virgule,
						angleRotation: Math.PI /60
					})
				},
				{
					attachNum : 300,
					whip:new Whip({
						x: 1100,
						y: 1150,
						linkCount: 300,
						maxLinkLength:1,
						width: 4,
						friction: friction + 0.085,
						deltaScale: deltaScale.normal,
						lineShape: new Easing({nbPeriod:1}).virgule,
						angleRotation: -Math.PI /60
					})
				},
		]
	})
);

whips.push(
	new Whip({
	  x: 100,
	  y: 100,
	  linkCount: 300,
	  maxLinkLength: 3,
	  width: 10,
	  friction: 0.7,
	  deltaScale: deltaScale.speed,
	  lineShape: new Easing({nbPeriod:4,injectedEasing:new Easing({nbPeriod:8}).linear}).combo
	})
);



	
	/*new Whip({
	  x: 100,
	  y: 100,
	  linkCount: 100,
	  maxLinkLength: 10,
	  width: 20,
	  friction: friction + 0.05,
	  deltaScale: deltaScale.normal,
	  lineShape: new Easing({nbPeriod:4}).combo
	}),*
	new Whip({
	  x: 1100,
	  y: 1150,
	  linkCount: 300,
	  maxLinkLength:4,
	  width: 4,
	  friction: friction + 0.06,
	  deltaScale: deltaScale.normal,
	  lineShape: new Easing({nbPeriod:1}).virgule
	}),
	new Whip({
	  x: 1100,
	  y: 1150,
	  linkCount: 300,
	  maxLinkLength:4,
	  width: 4,
	  friction: friction + 0.08,
	  deltaScale: deltaScale.normal,
	  lineShape: new Easing({nbPeriod:1}).virgule
	}),	
	new Whip({
	  x: 1100,
	  y: 1150,
	  linkCount: 200,
	  maxLinkLength:8,
	  width: 8,
	  friction: friction + 0.1,
	  deltaScale: deltaScale.normal,
	  lineShape: new Easing({nbPeriod:1}).virgule
	}),
	new Whip({
	  x: 100,
	  y: 100,
	  linkCount: 1200,
	  maxLinkLength: 1,
	  width: 20,
	  friction: 0.7,
	  deltaScale: deltaScale.speed,
	  lineShape: new Easing({nbPeriod:4,injectedEasing:new Easing({nbPeriod:16}).linear}).combo
	}),
	new Whip({
	  x: 1100,
	  y: 1150,
	  linkCount: 150,
	  maxLinkLength:4,
	  width: 30,
	  friction: friction + 0.01,
	  deltaScale: deltaScale.normal,
	  lineShape: new Easing({nbPeriod:1}).sansue
	}),*/
	/*new Whip({
	  x: 1000,
	  y: 100,
	  linkCount: 200,
	  maxLinkLength:5,
	  width: 20,
	  friction: friction + 0.05,
	  deltaScale: deltaScale.normal,
	  lineShape: new Easing({nbPeriod:16}).linear
	}),*/
	

function update() {
	whips.forEach(function(whip) {
		whip.update();
	});
}

function render() {
  // ctx.save();
  //ctx.clearRect( 0, 0, w, h );
  // black background
  
  ctx.fillStyle = "#000";
  ctx.fillRect(0,0,w,h);

//  ctx.drawImage(img,0,0,img.width,img.height,0,0,w,h);


  whips.forEach(function(whip) {
	whip.render( ctx );
	whip.subWhips.forEach(function(subWhip) {
		subWhip.whip.render( ctx );
	});
  });
  
  //ctx.restore();
}

var isAnimating = false;

function animate() {
  update();
  render();
  if ( isAnimating ) {
    requestAnimationFrame( animate );
  }
}

function stop() {
  isAnimating = false;
}

function start() {
  // particle.y = 160;
  isAnimating = true;
  animate();
}

// --------------------------  -------------------------- //

var canvasOffsetLeft, canvasOffsetTop;


function onMousedown( event ) {
  event.preventDefault();
  moveHinge( event );
  canvas.addEventListener( 'mousemove', moveHinge, false );
  canvas.addEventListener( 'mouseup', onMouseup, false );
}

var linkPositionA = [];
 whips.forEach(function(whip, index) {
	linkPositionA[index] = whip.links[0].particleA.position;
 });
 
 
function moveHinge( event ) {
  whips.forEach(function(whip, index) {
	linkPositionA[index].x = event.pageX - canvasOffsetLeft;
	linkPositionA[index].y = event.pageY - canvasOffsetTop;
  });

}

function onMouseup() {
  canvas.removeEventListener( 'mousemove', moveHinge, false );
  canvas.removeEventListener( 'mouseup', onMouseup, false );
}


