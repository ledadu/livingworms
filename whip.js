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


function Particle( props ) {
  this.layerIndex = props.layerIndex;
  this.position = new Vector( props.x, props.y );
  this.previousPosition = new Vector( props.x, props.y );
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
  var velocity = Vector.subtract( this.position, this.previousPosition );
  // friction
  velocity.scale( this.friction );
  this.previousPosition = Vector.copy( this.position );
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
  // big circle
  var newPosition = zoomCtx(this.position,2,1);
  circle( ctx, newPosition.x, newPosition.y, newPosition.size/4 ,newPosition.color );
  // dot
  // ctx.fillStyle = 'hsla(0, 100%, 50%, 0.5)';
  // circle( this.position.x, this.position.y, 5  );
};

function circle( ctx, x, y, radius , fillStyle) {
  fillStyle = fillStyle || '#000';
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
  var distance = Vector.getDistance( positionA, positionB );
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
	var newPosition = Vector.addDistance( positionA, this.maxLength, this.angle );
	var delta = Vector.subtract( newPosition, positionB );
	delta.scale( this.deltaScale )
	this.particleB.position.add( delta );
	this.particleB.previousPosition.add( delta );
	this.particleB.position = newPosition;
  
}


// --------------------------  -------------------------- //

WhipLink.prototype.render = function( ctx ) {
  ctx.lineWidth = this.particleB.size;
  line( ctx, this.particleA.position, this.particleB.position ,this.particleA.color);
  //circle( ctx, this.particleA.position.x,this.particleA.position.y, 4 ,'rgba(100%, 0%, 0%, 1)' );

};

function line( ctx, a, b , strokeStyle) {
  strokeStyle = strokeStyle || 'rgba(100%, 0%, 00%, 1)';
  ctx.beginPath();
  ctx.strokeStyle = strokeStyle;
  ctx.moveTo( a.x, a.y );
  ctx.lineTo( b.x, b.y );
  ctx.stroke();
  ctx.closePath();
}


// -------------------------- whip -------------------------- //

function Whip( props ) {
  this.layerIndex      = props.layerIndex || 0;
  this.linkCount       = props.linkCount || 1;
  this.maxLinkLength   = props.maxLinkLength;
  this.minLinkLength   = props.minLinkLength || 0;
  this.width           = props.width;
  this.lineShapeDef    = !_.isUndefined(props.lineShapeDef) ? props.lineShapeDef : {name:'linear',nbPeriod:1,injectedEasing:undefined} ;
  this.lineShape       = new Easing(this.lineShapeDef);
  this.friction        = !_.isUndefined(props.friction) ? props.friction : 0.85;
  this.deltaScale      = !_.isUndefined(props.deltaScale) ? props.deltaScale : 0.85;
  this.factorTime      = !_.isUndefined(props.factorTime) ? props.factorTime : globals.factorTime;
  this.renderBody      = props.renderBody || true;
  this.renderParticles = props.renderParticles || false;
  this.renderLinks     = props.renderLinks || false;
  
  this.angleRotation   = props.angleRotation || 0 ;
  this.angleStart      = props.angleStart || 0 ;
  this.angleMax        = props.angleMax || 'Math.PI * 2';
  this.paletteName     = _.isUndefined(props.paletteName) ? 'bleuVertOrange' : props.paletteName;
  this.subWhipsDef	   = props.subWhipsDef || {}; 
  this.subWhips		   = props.subWhips || []; 
  this.haveSubwhips    = props.haveSubwhips || false;

  this.createLinks(props.x, props.y);
  
}

Whip.prototype.createLinks = function(startX,startY) {
	var palette = new Palette(this.paletteName).setLineShape(this.lineShape).getColor(i/this.linkCount),
	    color = 'hsla(' + palette.h + ', ' + palette.s + '%, ' + palette.l + '%, ' + palette.transparency + ')';
		
	this.links = [];
	
	for ( var i=0; i <= this.linkCount; i++ ) {
			
		this.links[i] = this.createLink(
			i,
			i === 0 ? new Particle( 
			  {
				layerIndex: this.layerIndex+i,
				x: startX,
				y: startY,
				friction: this.friction,
				size:this.lineShape.getEasing(this.width, i / this.linkCount ),
				color: color,
				isPinned :true
			  }
			) :
			this.links[ i - 1 ].particleB
		);
	} 
};


Whip.prototype.createLink = function(i, particleA) {
	var palette = new Palette(this.paletteName).setLineShape(this.lineShape).getColor(i/this.linkCount),
		time   = (new Date().getTime() - startingTime)  / globals.factorTime,
	    color = 'hsla(' + palette.h + ', ' + palette.s + '%, ' + palette.l + '%, ' + palette.transparency + ')';
			  
	particleA.layerIndex = this.layerIndex;
	
	return new WhipLink({
			  layerIndex: this.layerIndex,
			  particleA: particleA,
			  particleB: new Particle({
				layerIndex: particleA.layerIndex,
				x: particleA.position.x,
				y: particleA.position.y,
				size:this.lineShape.getEasing(this.width, i / this.linkCount ),
				color: color,
				friction: this.friction
			  }),
			  maxLength: this.maxLinkLength,
			  minLength: this.minLinkLength,
			  deltaScale: this.deltaScale,
			  angleRotation : (i <= this.linkCount) ? (catchedEval(this.angleRotation,{i:i, time:time}) * (this.linkCount-i)/this.linkCount ) : 0,
			  angleFixed : null,
	});
}


Whip.prototype.updateLinks = function() {

	var time   = (new Date().getTime() - startingTime)  / globals.factorTime;
  
	for ( var i=0; i <= this.linkCount; i++ ) {
    
      var palette = new Palette(this.paletteName).setLineShape(this.lineShape).getColor(i/this.linkCount),
	    color = 'hsla(' + palette.h + ', ' + palette.s + '%, ' + palette.l + '%, ' + palette.transparency + ')';
			  
		if (!_.isUndefined(this.links[i])) {
			this.links[i].maxLength      = this.maxLinkLength; 
			this.links[i].minLength      = this.minLinkLength;
			this.links[i].deltaScale     = this.deltaScale;
			this.links[i].angleRotation  = (i <= this.linkCount) ? (catchedEval(this.angleRotation,{i:i, time:time})* (this.linkCount-i)/this.linkCount ) : 0;
      this.links[i].particleA.size = this.lineShape.getEasing(this.width, i / this.linkCount );
			this.links[i].particleA.color = color;
			this.links[i].particleA.friction = this.friction;
      
      this.links[i].particleB.size = this.lineShape.getEasing(this.width, i / this.linkCount );
			this.links[i].particleB.color = color;
			this.links[i].particleB.friction = this.friction;
		}else{
			this.links[i] = this.createLink(i, this.links[ i - 1 ].particleB);			
		}
	}
	// cut the rest
	this.links = _.first(this.links,i);
	
};



Whip.prototype.getDefinitions = function() {
	return {
	/*	linkCount		: {class:'integer'},
		minLinkLength	: {class:'float'},
		maxLinkLength	: {class:'float'},
		width			: {class:'float'},
		angleRotation	: {class:'float'},
		angleStart		: {class:'float'},
		angleMax		: {class:'float'},
		paletteName	    : {class:'paletteName'},
		lineShapeDef    : {class:'easingOptions'},
		friction		: {class:'float'},
		deltaScale		: {class:'float'},
		renderBody		: {class:'boolean'},
		renderParticles : {class:'boolean'},
		renderLinks		: {class:'boolean'},	*/	
		haveSubwhips    : {class:'boolean'},
		subWhipsDef		: {class:'subWhipsDef'},
    	//subWhips		: {class:'Whips'},
	}
}

Whip.prototype.toJSON = function() {
	
	return {
		/*linkCount		: this.linkCount,
		minLinkLength	: this.minLinkLength,
		maxLinkLength	: this.maxLinkLength,
		width			: this.width,
		lineShapeDef    : this.lineShapeDef,
		friction		: this.friction,
		deltaScale		: this.deltaScale,
		renderBody		: this.renderBody,
		renderParticles : this.renderParticles,
		renderLinks		: this.renderLinks,
		angleRotation	: this.angleRotation,
		angleStart		: this.angleStart,
		angleMax		: this.angleMax,
		paletteName	    : this.paletteName,*/
		haveSubwhips    : this.haveSubwhips,
		subWhipsDef		: this.subWhipsDef,
	    /*subWhips		: _.each(this.subWhips, function(attachNode){
	      attachNodeJson = _.clone(attachNode);
	      attachNodeJson.whip = attachNodeJson.whip.ToJson;
	      return attachNodeJson;
	    }),*/
	}
};

Whip.prototype.getAngleFromLinks = function(links1, links2) {
	var a = links1.particleA.position.x
}

Whip.prototype.update = function() {
	var that = this,
		time   = (new Date().getTime() - startingTime)  / globals.factorTime;
		
	//update sub attributes (TODO better trigger on change attributes..)
	var lineShapeDef = _.clone(this.lineShapeDef),
		newNbperiod = catchedEval(lineShapeDef.nbPeriod,{time:time});

	lineShapeDef.nbPeriod = _.isUndefined(newNbperiod) ? lineShapeDef.nbPeriod : newNbperiod ;

	var newEasing = new Easing(lineShapeDef);
	if (!_.isUndefined(newEasing.easings[lineShapeDef.name])){
		this.lineShape       = newEasing;
	}

	this.updateLinks();

	for ( var i=0, len = this.links.length; i < len; i++ ) {
		this.links[i].update();
		
		if (i > 0){
			var deltaAngle = testDeltaAngle = this.links[i-1].angle - this.links[i].angle,
				deltaPi = 0;
				
			if (deltaAngle > Math.PI){
				testDeltaAngle = deltaAngle - Math.PI*2;
				 deltaPi = -Math.PI*2;
			}
			if (deltaAngle < -Math.PI){
				testDeltaAngle = deltaAngle + Math.PI*2;
				deltaPi = Math.PI*2;
			}

			var difAngle = 0,
				angleMax = catchedEval(this.angleMax,{i:i, time:time}) * ((len-i)/len);
			if( testDeltaAngle > angleMax && testDeltaAngle > 0 ){			
				difAngle = testDeltaAngle - angleMax ;
				this.links[i].updateParticleBWhithAngle(this.links[i].angle + difAngle * globals.reactAngle + deltaPi);
			}
			if( testDeltaAngle < -angleMax && testDeltaAngle < 0 ){
				difAngle = testDeltaAngle - angleMax ;
				this.links[i].updateParticleBWhithAngle(this.links[i].angle + difAngle * globals.reactAngle + deltaPi);
			}

		}
	}

	/*if(this.haveSubwhips) {
       	this.subWhipsDef.renderBody      = this.subWhipsDef.renderBody || true;
  		this.subWhipsDef.renderParticles = this.subWhipsDef.renderParticles || false;
  		this.subWhipsDef.renderLinks     = this.subWhipsDef.renderLinks || false;
	}*/


	this.updateSubWhipsDef(this);

	this.updateSubWhips();

};

Whip.prototype.updateSubWhipsDef = function(subDef){

    if (!subDef.haveSubwhips) {
		subDef.subWhipsDef = {};
    }else{
    	if( _.isEmpty(subDef.subWhipsDef)) {
			subDef.subWhipsDef = {
				nbsubs          : '1',
				linkCount       : '1',
				attachNum       : '0',
				angleStart	    : '0',
				angleMax	    : 'Math.PI * 2',
				angleRotation   : 0, 
				minLinkLength	: '0',
                maxLinkLength	: '5',				
				width 			: 2,
				friction		: 0.85,
				factorTime		: 'globals.factorTime',
				deltaScale		: deltaScale.normal,
				lineShapeDef	: {name:'virgule', nbPeriod:'1'},
				paletteName 	: 'test',
				renderLinks     : false,
	            renderBody      : true,
	            renderParticles : false,
	            haveSubwhips    : false,
	            subWhipsDef     : {},
	        };
	    }else{
	    	this.updateSubWhipsDef(subDef.subWhipsDef);
	    }

    }

};

Whip.prototype.updateSubWhips = function(){
	var that = this,
		nbsubs = this.subWhipsDef.nbsubs || this.subWhips.length,	//default if not set
		time   = (new Date().getTime() - startingTime)  / globals.factorTime;

	this.subWhips = _.first(this.subWhips, nbsubs);
	//console.log(nbsubs);
	for (var i = 0; i < nbsubs; i++) {
		var subWhipEval = {};

		_.each(that.subWhipsDef, function(subDef,subDefName){
			if(subDefName =='lineShapeDef' || subDefName === 'paletteName'){
				//console.log(subDef);
				subWhipEval[subDefName] =  _.clone(subDef);
			}else{
				var newSubDef = catchedEval(subDef,{i:i, nbsubs:nbsubs, time:time});
				if(!_.isUndefined(newSubDef)){
					subWhipEval[subDefName] = newSubDef;
				}
			}

		//
		});


		if(!_.isUndefined(that.subWhipsDef.lineShapeDef)){
			subWhipEval.lineShapeDef.nbPeriod = eval(that.subWhipsDef.lineShapeDef.nbPeriod);
		}

		// create subwhip if not exist
		if(_.isUndefined(that.subWhips[i])){
			
			subWhipEval.layerIndex = this.layerIndex + subWhipEval.attachNum;
			
			that.subWhips.push(
				{
					attachNum : subWhipEval.attachNum,
					whip      : new Whip(subWhipEval)
				}			
			);

		}

		var subWhip = that.subWhips[i];
		
		

		_.each(that.subWhipsDef, function(subDef,subDefName){

			if(!_.isUndefined(subWhipEval)){	
				subWhip.attachNum = subWhipEval.attachNum;
			}
			if(subDefName ==='lineShapeDef'){
				subWhip.whip[subDefName] = {'name':subDef.name,'nbPeriod':eval(subDef.nbPeriod)};
			}else if(subDefName ==='paletteName'){
				subWhip.whip[subDefName] = subDef;
			}else{			
				var newSubDef = catchedEval(subDef,{i:i, nbsubs:nbsubs, time:time});
				subWhip.whip[subDefName] = newSubDef;
			}
		});
		
		// link subwhip to parent
		subWhip.whip.linkCount = subWhip.whip.linkCount || 1;

		if (subWhip.attachNum <= this.linkCount+1){

			var particle = 'particleA'
				attachNum = subWhip.attachNum;

			//attach to the last particle
			if (subWhip.attachNum == this.linkCount+1){
				particle = 'particleB';
				attachNum -= 1;

			}
			
			this.links[attachNum].layerIndex = subWhip.layerIndex;
			
			subWhip.whip.links[0]['particleA'].position.x = that.links[attachNum][particle].position.x;
			subWhip.whip.links[0]['particleA'].position.y = that.links[attachNum][particle].position.y;
			subWhip.whip.links[0].angleFixed = that.links[attachNum].angle + subWhip.whip.angleStart;
			
		}

		subWhip.whip.update();

		
	}

	//check if have to create subwips
	/*if (nbsubs > this.subWhips.length){

		this.subWhips.push(
			{
				attachNum : subWhipEval.attachNum,
				whip      : new Whip(subWhipEval)
			}
			
		);
	}*/

};

Whip.prototype.render = function( ctx ) {
	
  if(this.renderBody){
    var position = this.links[0].particleA.position,
        palette = new Palette(this.paletteName).setLineShape(this.lineShape).getColor(0),
          color = 'hsla(' + palette.h + ', ' + palette.s + '%, ' + palette.l + '%, ' + palette.transparency + ')';
        
    circle( ctx, position.x, position.y ,this.lineShape.getEasing(this.width, 0 ), color ); 
    for ( var len = this.links.length, i=len-1; i >= 0; i-- ) {
      var link = this.links[i];

      position = link.particleB.position;
      var palette = new Palette(this.paletteName).setLineShape(this.lineShape).getColor(i/this.linkCount),
          color = 'hsla(' + palette.h + ', ' + palette.s + '%, ' + palette.l + '%, ' + palette.transparency + ')';

      circle( ctx, position.x, position.y , this.lineShape.getEasing(this.width, i / this.linkCount ), color); 
    }
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
	
	this.subWhips.forEach(function(subWhip) {
		subWhip.whip.render( ctx );
	});
	  
  
};



// --------------------------  -------------------------- //

var Easing = function(options){
	var that = this
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
  

var Palette = function(paletteName, lineShape){
	
	var that = this;

	this.palettes = {
		bleuVertOrange: function(iteration ) {
			return {
				h : 90 * that.lineShape.getEasing(1,iteration)-20,
				s : 50 + 50 * that.lineShape.getEasing(1,iteration*6),
				l : 50 + 10 * that.lineShape.getEasing(1,iteration*4),
				transparency : 0.0835
			};
		},
		test: function(iteration){
			return {
				h : 90 * that.lineShape.getEasing(1,iteration)+80,
				s : 30 + 50 * that.lineShape.getEasing(1,iteration*4),
				l : 60 + 5 * that.lineShape.getEasing(1,iteration*4),
				transparency : 0.535
			};
		},
		orangeDark: function(iteration){	
			return {
				h : 2 * that.lineShape.getEasing(1,iteration)+350,
				s : 70 + 10 * that.lineShape.getEasing(1,iteration*6),
				l : 10 + 20 * that.lineShape.getEasing(1,iteration*4),
				transparency : 0.535
			};
		},
		mega: function(iteration){	
			return {
				h : 360 * that.lineShape.getEasing(1,iteration),
				s : 70 + 10 * that.lineShape.getEasing(1,iteration*6),
				l : 50 + 20 * that.lineShape.getEasing(1,iteration*4),
				transparency : 0.535
			};
		},
	};
	
	this.paletteName = (_.isUndefined(paletteName) || _.isUndefined(this.palettes[paletteName]) ) ? 'bleuVertOrange' : paletteName;
	this.lineShape   = lineShape || new Easing();
	

};

Palette.prototype.getColor = function(iteration) { // iteration 0 to 1
	return this.palettes[this.paletteName](iteration);
}

Palette.prototype.setLineShape = function(lineShape) { // iteration 0 to 1
	this.lineShape = lineShape || new Easing();
	return this;
}



var renderForm = function() {

	console.log('--- renderForm ---');

	var $wormEdit   = $('#wormEdit'),
		$saveButton = $('<div>Save</div>'),
		$loadButton = $('<div>Load</div>');

	$wormEdit.html('');

	$wormEdit.append(renderFieldset('globals', globals, {factorTime:{class:'integer'},reactAngle:{class:'float'}}, globals));
	
  
	_.each(whips, function(whip,i){        

  		//renderGuiWhip(mainGui, whip);
  		$wormEdit.append(renderFieldset('Whip', whip, whip.getDefinitions(), whip.toJSON()));


	}); 

	$wormEdit.append('<textArea id="savedContent"></textArea>');
	$saveButton.on('click', function(e){
		$('#savedContent').val(JSON.stringify(whips[0].toJSON()));
	});
	$wormEdit.append($saveButton);

	$wormEdit.append('<textArea id="LoadContent"></textArea>');
	$loadButton.on('click', function(e){
		$.extend(whips[0], JSON.parse($('#LoadContent').val()));
		console.log('load');
		renderForm();
	});
	$wormEdit.append($loadButton);

	
}

var renderFieldset = function(className, objectToBind, definitions, values) {

        var $fieldset  = $('<fieldset data-class="' + className + '"><legend>' + className + ' :</legend></fieldset>');
        
		//drawn form
		_.each(definitions, function(def,defName){
			var def = def
        	
        	if (defName !== 'subWhipsDef' && defName !== 'lineShapeDef') {
        		$fieldset.append('<label>'+ defName + '</label>' );
        	}
            
            // boolean  
            if (def.class == 'boolean') {
                $fieldset.append('<input type="checkbox" ' + (values[defName]===true ? 'checked="CHECKED"' : '') + ' name="' + defName + '" data-class="' + def.class + '"></input>');  

            // paletteName
            } else if(def.class === 'paletteName') {
				var paletteDef = new Palette();
					$selector = $('<select name="' + defName + '" data-class="' + def.class + '"></select>');
				_.each(_.keys(paletteDef.palettes), function(key){
					var $option = $('<option></option>');
					$option.attr('value', key).html(key);
					if (values[defName] === key ) {
						$option.prop('selected','selected');
					}
					$selector.append($option);
				});
            	$fieldset.append($selector);

           	// easingName
			} else if(def.class === 'easingName') {
				var easingDef = new Easing();
					$selector = $('<select name="' + defName + '" data-class="' + def.class + '"></select>');
				_.each(_.keys(easingDef.easings), function(key){
					var $option = $('<option></option>');
					$option.attr('value', key).html(key);
					if (values[defName] === key ) {
						$option.prop('selected','selected');
					}
					$selector.append($option);
				});
            	$fieldset.append($selector);
            
            // Whips             
            } else if(def.class === 'Whips') {
                _.each(objectToBind.subWhips, function(subwhip,i){
                    $fieldset.append(renderFieldset('Whip', subwhip.whip, subwhip.whip.getDefinitions(), subwhip.whip.toJSON()));
                }); 

            // easingOptions
            } else if(def.class === 'easingOptions') {  
            	if(!_.isUndefined(objectToBind[defName])){
	            	$fieldset.append(
	        			renderFieldset(
		        			defName,
		        			objectToBind.lineShapeDef,
		        			{
		        				name		: {class:'easingName'},
								nbPeriod    : {class:'float'},
								offset      : {class:'float'}
							},
							{
								name		: values[defName].name,
								nbPeriod    : values[defName].nbPeriod
							}
						)
	        		);
        		}
    		 } else if(def.class === 'subWhipsDef') {    
    		 	if (values.haveSubwhips===true){
	            	$fieldset.append(
	        			renderFieldset(
		        			defName,
		        			objectToBind.subWhipsDef,
		        			{
		        				linkCount		: {class:'string'},
		        				nbsubs			: {class:'integer'},
		        				attachNum		: {class:'integer'},
		        				width 			: {class:'float'},
		        				angleRotation   : {class:'float'},
		        				angleStart		: {class:'float'},
		        				angleMax        : {class:'float'},
		        				minLinkLength	: {class:'float'},
		        				maxLinkLength	: {class:'float'},
								paletteName 	: {class:'paletteName'},							
								lineShapeDef	: {class:'easingOptions'},
								friction		: {class:'float'},
								deltaScale		: {class:'float'},
								factorTime		: {class:'integer'},								
								renderBody		: {class:'boolean'},
		        				renderParticles	: {class:'boolean'},
		        				renderLinks		: {class:'boolean'},
								haveSubwhips    : {class:'boolean'},
								subWhipsDef		: {class:'subWhipsDef'},
							},
							{
								linkCount		: values[defName].linkCount,
								nbsubs			: values[defName].nbsubs,
								attachNum		: values[defName].attachNum,								
								paletteName 	: values[defName].paletteName,
								angleRotation	: values[defName].angleRotation,
								angleStart      : values[defName].angleStart,
								angleMax        : values[defName].angleMax,
								minLinkLength	: values[defName].minLinkLength,
								maxLinkLength	: values[defName].maxLinkLength,
								width 			: values[defName].width,
								friction		: values[defName].friction,
								deltaScale		: values[defName].deltaScale,
								factorTime		: values[defName].factorTime,
								lineShapeDef	: values[defName].lineShapeDef,
								renderBody		: values[defName].renderBody || true,
		        				renderParticles	: values[defName].renderParticles || false,
		        				renderLinks		: values[defName].renderLinks || false,
								haveSubwhips    : values[defName].haveSubwhips,
								subWhipsDef		: values[defName].subWhipsDef,
							}
						)
	        		);
				}
            } else {
            	
        		$fieldset.append('<input name="' + defName + '" data-class="' + def.class + '" value="' + values[defName] + '"></input>');
            }
              
           
            
			$fieldset.append('<br/>');
		});
		

		//bind input change
         
		$('>input, >select', $fieldset).on('change', function(e){
			var $target       = $(e.currentTarget),
				fieldsetClass = $target.closest('fieldset').attr('data-class'); 
				propName      = $target.attr('name'),
				value         = $target.val();  //get input value
      
		    // get checkbox value
		    if($target.attr('data-class') == 'boolean'){
		    	value = $target.prop('checked');
		    }

		    //Change Value
			objectToBind[propName] = value; 

			//Re-render form
			if($target.attr('name') == 'haveSubwhips'){
		    	setTimeout(renderForm,100);
		    }
      
		});

		
		return $fieldset;

}




var canvas = null;
var ctx = null;
var w = 0;
var h = 0;
var img=new Image();
var startingTime = new Date().getTime();
var mainGui = {};

$(document).ready(function() {
	canvas = $('canvas').get(0);
	w = canvas.width = window.innerWidth - 20;
	h = canvas.height = window.innerHeight - 20;
	ctx = canvas.getContext('2d');
	
	 canvas.addEventListener( 'mousedown', onMouseDown, false );
	 canvas.addEventListener( 'mousemove', onMouseMove, false );

	 canvas.addEventListener( 'touchstart', onTouchStart, false );
	 canvas.addEventListener( 'touchmove', onTouchMove, false );
	  var rect = canvas.getBoundingClientRect();
	  canvasOffsetLeft = rect.left;
	  canvasOffsetTop = rect.top;
	  
    img.onload=function(){
        //ctx.drawImage(img,0,0,img.width,img.height,0,0,w,h);
		ctx.fillStyle = "rgba(0,0,0,1)";
		ctx.fillRect(0,0,w,h);
    }
    //img.src="http://static9.depositphotos.com/1001311/1123/i/950/depositphotos_11236001-The-brown-wood-texture-with-natural-patterns.jpg";
	
	//mainGui = new dat.GUI();

	renderForm();

	console.log(whips);
	


	start();
});


var gravity    = new Vector( 0, 0/*.8*/ );
var deltaScale = {
	normal : 0.85,
	speed  : 0.6,
};

var globals = {
	factorTime : 100,
	reactAngle: 0.05,
};


var whips = [];

// 1rst bestiole

/*
whips.push(
	new Whip({
		x: 100,
		y: 100,
		linkCount: 60,
		maxLinkLength: 7,
		width: 40,
		friction: 0.7,
		deltaScale: deltaScale.speed,
		// lineShape: new Easing({nbPeriod:4, injectedEasing:new Easing({nbPeriod:16}).linear}).combo,
		lineShapeDef:{name:'sansue', nbPeriod:1},
		paletteName: 'test'
	})
);
*/
/*
var nbsubs = 24;
whips.push(
	new Whip({
		x: 100,
		y: 100,
		linkCount: 600,
		maxLinkLength: 2,
		width: 20,
		friction: 0.7,
		deltaScale: deltaScale.speed,
		// lineShape: new Easing({nbPeriod:4, injectedEasing:new Easing({nbPeriod:16}).linear}).combo,
		lineShapeDef: {name:'combo', nbPeriod:'1+Math.sin(time/20)/2'},
		renderParticles:true,
		subWhipsDef	: {
			linkCount     : 'Math.round((nbsubs - i)/nbsubs * 50)',
			attachNum     : 'Math.round(Math.floor(i/2) * 50 * (0.5+Math.sin(-time/20) /4))',
			angleStart	  : 'Math.sin(time/20) * Math.PI/4 *  ( (i % 2)==0 ? 1 : -1 )',
			angleMax	  : 0.2,
			angleRotation : 0, 
			nbsubs        :  nbsubs,
			maxLinkLength	: 10,
			width 			: 5,
			friction		: friction + 0.085,
			deltaScale		: deltaScale.normal,
			lineShapeDef	: {name:'virgule', nbPeriod:'1'},
			paletteName 	: 'test',
			renderLinks     : true
		},
		subWhips: new function(){
			var _subWhips = [];
			for ( var i=2; i < nbsubs; i++ ) {
				
				var subWhip = {
					attachNum : Math.floor(i/2) * 50,
					whip: new Whip({
						x: 1100,
						y: 1150,
						linkCount: Math.round((nbsubs - i)/nbsubs * 200),
						maxLinkLength:3,
						width: 2,
						friction: friction + 0.085,
						deltaScale: deltaScale.normal,
						lineShapeDef: {name:'worm', nbPeriod:nbsubs/(i*2)},
						paletteName: 'mega',
						angleRotation: Math.PI /60 * ( (i % 2)==0 ? 1 : -1 ),
					})
				};				
				_subWhips.push(subWhip);
			}	
			return _subWhips;				
				
		}
	})
);
*/
/*
whips.push(
	new Whip({
	  x: 100,
	  y: 100,
	  linkCount: 300,
	  maxLinkLength: 3,
	  width: 10,
	  friction: 0.7,
	  deltaScale: deltaScale.speed,
	  lineShapeDef: {name:'combo', nbPeriod:4, injectedEasingDef:{nbPeriod:8}}
	})
);
*/

// 2eme bestiole
/*
whips.push(
	new Whip({
		x: 100,
		y: 100,
		linkCount: 50,
		maxLinkLength: 15,
		width: 30,
		friction: 0.7,
		angleMax: Math.PI/7,
		deltaScale: deltaScale.speed,
		// lineShape: new Easing({nbPeriod:4, injectedEasing:new Easing({nbPeriod:16}).linear}).combo,
		lineShapeDef:{name:'sansue', nbPeriod:1},
		paletteName: 'test',
		// renderParticles:true,	
		//renderLinks:true,	
		subWhips: new function(){
			var _subWhips = [];
			for ( var i=2; i < 48; i++ ) {				
				var subWhip = {
					attachNum :  Math.floor(i/2) * 2,
					whip: new Whip({
						x: 1100,
						y: 1150,
						linkCount: 1,
						maxLinkLength: new Easing({name:'sansue', nbPeriod:1}).getEasing(30, Math.floor(i/2) * 12 /300),
						minLinkLength: new Easing({name:'sansue', nbPeriod:1}).getEasing(30, Math.floor(i/2) * 12 /300),
						width: 1,
						friction: friction + 0.085,
						deltaScale: deltaScale.normal,
						lineShapeDef: {name:'virgule', nbPeriod:1},
						paletteName: 'orangeDark',
						angleStart: Math.PI/2 * ( (i % 2)==0 ? 1 : -1 ),
						subWhips: [{
								attachNum : 1,
								whip: new Whip({
									x: 1100,
									y: 1150,
									linkCount:50,
									maxLinkLength:2,
									width: 2,
									friction: friction + 0.075,
									deltaScale: deltaScale.normal,
									lineShapeDef: {name:'virgule', nbPeriod:1},
									// palette: Palettes.orangeDark
								})
							}]
					})
				};				
				_subWhips.push(subWhip);
			}
			return _subWhips;	
		},	
	
	})
);
*/




// 3eme bestiole
/*
var nbsubs = 50;
whips.push(
	new Whip({
		x: 100,
		y: 100,
		linkCount: 100,
		maxLinkLength: 10,
		width: 15,
		friction: 0.7,
		//angleMax: Math.PI/7,
		deltaScale: deltaScale.speed,
		// lineShape: new Easing({nbPeriod:4, injectedEasing:new Easing({nbPeriod:16}).linear}).combo,
		lineShapeDef: {name:'worm',nbPeriod:1},
		paletteName: 'orangeDark',
		// renderParticles:true,	
		//renderLinks:true,	
		subWhipsDef	: {
			nbsubs        :  nbsubs,
			linkCount     : '1',
			attachNum     : 'Math.floor(i/2) * 4',
			angleStart	  : 'Math.PI/2 * ( (i % 2)==0 ? 1 : -1 )',
			angleMax	  : 0.2,
			angleRotation : 0, 
			maxLinkLength	: 'new Easing({name:\'worm\', nbPeriod:1}).getEasing(15, Math.floor(i/2) * 8 /26)',
			minLinkLength	: 'new Easing({name:\'worm\', nbPeriod:1}).getEasing(15, Math.floor(i/2) * 8 /26)',
			width 			: 1,
			friction		: friction + 0.085,
			deltaScale		: deltaScale.normal,
			lineShapeDef	: {name:'virgule', nbPeriod:'1'},
			paletteName 	: 'test',
			renderLinks:false,	
            renderBody:false,
            renderParticles:false,
			subWhipsDef	: {
				nbsubs  :  1,
				attachNum : 0,
              	renderLinks:false,	
	            renderBody:true,
	            renderParticles:false,
				linkCount:10,
		        angleMax: 'Math.PI/90',
				maxLinkLength:4,
				minLinkLength:4,
				width: 3,
				friction:  1,
				deltaScale: deltaScale.speed,
				lineShapeDef: {name:'worm', nbPeriod:1.8},
				paletteName: 'orangeDark'
			}
		}	
	})
);
*/
/*
var nbsubs = 40;
whips.push(
	new Whip({
		x: 100,
		y: 100,
		linkCount: 100,
		maxLinkLength: 2,
		width: 40,
		friction: 0.7,
		deltaScale: deltaScale.speed,
		// lineShape: new Easing({nbPeriod:4, injectedEasing:new Easing({nbPeriod:16}).linear}).combo,
		lineShapeDef: {name:'sansue', nbPeriod:1},
		paletteName: 'test',
		renderParticles:true,
		subWhips: new function(){
			var _subWhips = [];
			for ( var i=2; i < nbsubs; i++ ) {				
				var subWhip = {
					attachNum : Math.floor(i/2) * 3,
					whip: new Whip({
						x: 1100,
						y: 1150,
						linkCount: Math.round(new Easing({name:'sansue', nbPeriod:1}).getEasing(1,i/nbsubs) * 20),
						maxLinkLength:2,
						width: 1,
						friction: friction + 0.085,
						deltaScale: deltaScale.normal,
						lineShapeDef: {name:'virgule', nbPeriod:1},
						angleRotation: Math.PI /60 * ( (i % 2)==0 ? 1 : -1 ),
						paletteName: 'orangeDark',
					})
				};				
				_subWhips.push(subWhip);
			}
			return _subWhips;	
		},				
	})
);
*/

// 4 eme bestiole
/*
var nbsubs = 24;
whips.push(
	new Whip({
		x: 100,
		y: 100,
		linkCount: 600,
		maxLinkLength: 2,
		width: 20,
		friction: 0.7,
		deltaScale: deltaScale.speed,
		// lineShape: new Easing({nbPeriod:4, injectedEasing:new Easing({nbPeriod:16}).linear}).combo,
		lineShapeDef: {name:'combo', nbPeriod:'1+Math.sin(time/20)/2'},
		renderParticles:true,
	})
);

*/

//bestiole preset
var nbsubs = 0;
whips.push(
	new Whip({
		x: 100,
		y: 100,
		linkCount: 1,
		maxLinkLength: 0,
		width: 0,
		friction: 0,
		//angleMax: Math.PI/7,
		//deltaScale: deltaScale.speed,
		// lineShape: new Easing({nbPeriod:4, injectedEasing:new Easing({nbPeriod:16}).linear}).combo,
		//lineShapeDef: {name:'worm',nbPeriod:1},
		//paletteName: 'orangeDark',
		// renderParticles:true,	
		//renderLinks:true,	
        renderBody:false,	
	})
);

function update() {
	whips.forEach(function(whip) {
		whip.update();
	});
}

function render() {
  // ctx.save();
  //ctx.clearRect( 0, 0, w, h );
  // black background
  
  ctx.fillStyle = "rgba(0,0,0,1)";
  ctx.fillRect(0,0,w,h);

 //ctx.drawImage(img,0,0,img.width,img.height,0,0,w,h);


  whips.forEach(function(whip) {
	whip.render( ctx );
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


function onMouseDown( event ) {
  event.preventDefault();
  moveHinge( event );
 /* canvas.addEventListener( 'mousemove', moveHnige, false );
  canvas.addEventListener( 'mouseup', onMouseup, false );*/
}

function onMouseMove( event ) {
  event.preventDefault();
  if (event.buttons===1) {
  	moveHinge( event );
  }
}

function onTouchStart( event ) {
  event.preventDefault();
  moveHinge( event.changedTouches[0] );
}

function onTouchMove( event ) {
  event.preventDefault();
  moveHinge( event.changedTouches[0] );
}
/*
function onMouseup() {
  canvas.removeEventListener( 'mousemove', moveHinge, false );
  canvas.removeEventListener( 'mouseup', onMouseup, false );
}*/

var linkPositionA = [];
 whips.forEach(function(whip, index) {
	linkPositionA[index] = whip.links[0].particleA.position;
 });
 
 //todo add targetposition in particle or whip..
function moveHinge( event ) {
  whips.forEach(function(whip, index) {
	linkPositionA[index].x += (event.pageX - canvasOffsetLeft - linkPositionA[index].x) * 0.5;
	linkPositionA[index].y += (event.pageY - canvasOffsetTop  - linkPositionA[index].y) * 0.5;
	//linkPositionA[index].update();
  });

}


function catchedEval(code, variables){

	if(!_.isUndefined(variables)){			
		var i      = variables.i;
		var nbsubs = variables.nbsubs;
		var time   = variables.time;
	}

	try{
	   var newValue = eval(code);
	   return newValue;
	}
	catch(e){
		console.log("catchedEval : " + e.name + "\n" + e.message)
		return undefined;	    
	}
}


