// -------------------------- whip -------------------------- //

const startingTime = new Date().getTime();
// AIE EN double!!!!!! FAUX !!!!!!
const globals = {
	factorTime : 100,
	reactAngle: 0.05,
};

const deltaScale = {
	normal : 0.85,
	speed  : 0.6,
};

import { Vector } from './Vector.js';
import { Easing } from './Easing.js';
import { Palette } from './Palette.js';

import { Particle } from './Particle.js';
import { WhipLink } from './WhipLink.js';

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


const sprites = {
	models : [],
	isNew  : true,
	add	   : function(model) {
		sprites.models.push(model);
	},
	empty  : function(){
		sprites.models = [];
		sprites.isNew   = true;
	}
};


const Whip = function( props ) {
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
  this.mygraph 		   = new PIXI.Graphics();
  this.textureName     = props.textureName || false;
  this.loadedResource  = props.loadedResource;
  
  this.sprites		   = sprites;
  

  this.createLinks(props.x, props.y);

}

Whip.prototype.createLinks = function(startX,startY) {
	var that    = this,
		palette = new Palette(this.paletteName).setLineShape(this.lineShape).getColor(i/this.linkCount),
	    color   = palette;

	this.links = [];

	for ( var i=0; i <= this.linkCount; i++ ) {

		this.links[i] = this.createLink(
			i,
			i === 0 ? new Particle(
			  {
				whipLink: this,
				layerIndex: this.layerIndex + this.linkCount + i,
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
	    color   = palette,
	    //color = 'hsla(' + palette.h + ', ' + palette.s + '%, ' + palette.l + '%, ' + palette.transparency + ')',
		newWhipLink = new WhipLink({
			  whip: this,
			  layerIndex: this.layerIndex + i,
			  particleA: particleA,
			  particleB: null,
			  maxLength: this.maxLinkLength,
			  minLength: this.minLinkLength,
			  deltaScale: this.deltaScale,
			  angleRotation : (i <= this.linkCount) ? (catchedEval(this.angleRotation,{i:i, time:time}) * (this.linkCount-i)/this.linkCount ) : 0,
			  angleFixed : null,
	});
	
	particleA.layerIndex  = this.layerIndex + this.linkCount + i;
	//Add whiplink
	newWhipLink.particleA.whipLink = newWhipLink;
	newWhipLink.particleB = new Particle({
		whipLink: newWhipLink,
		layerIndex: particleA.layerIndex + this.linkCount + i,
		x: particleA.position.x,
		y: particleA.position.y,
		size:this.lineShape.getEasing(this.width, i / this.linkCount ),
		color: color,
		friction: this.friction
	});

	return newWhipLink;
}


Whip.prototype.updateLinks = function() {

	var time   = (new Date().getTime() - startingTime)  / globals.factorTime;

	for ( var i=0; i <= this.linkCount; i++ ) {

      var palette = new Palette(this.paletteName).setLineShape(this.lineShape).getColor(i/this.linkCount),
	    //color = 'hsla(' + palette.h + ', ' + palette.s + '%, ' + palette.l + '%, ' + palette.transparency + ')';
	    color   = palette;

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
		}
		else{
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

	//Follow target
	if (!_.isUndefined(this.target)) {
		this.links[0].particleA.position.x += (this.target.x - this.links[0].particleA.position.x)*0.1;
		this.links[0].particleA.position.y += (this.target.y - this.links[0].particleA.position.y)*0.1;
	}

	this.updateLinks();

	for ( var i=0, len = this.links.length; i < len; i++ ) {
		this.links[i].update();

		if (i > 0){
			var deltaAngle = (this.links[i-1].angle - this.links[i].angle) % (Math.PI*2),
				testDeltaAngle = deltaAngle,
				deltaPi = 0;

			if (deltaAngle >= Math.PI){
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
		
		if (i < this.linkCount && this.sprites.isNew){
			this.sprites.add(this.links[i]);
			this.sprites.add(this.links[i].particleA);
		}
		
	}

	/*if(this.haveSubwhips) {
       	this.subWhipsDef.renderBody      = this.subWhipsDef.renderBody || true;
  		this.subWhipsDef.renderParticles = this.subWhipsDef.renderParticles || false;
  		this.subWhipsDef.renderLinks     = this.subWhipsDef.renderLinks || false;
	}*/
	
	if (this.sprites.isNew) {
		this.sprites.add(this);
	}
	
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
				textureName	 	: 'dragon',
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
			if(subDefName =='lineShapeDef' || subDefName === 'paletteName' || subDefName === 'textureName'){
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

			var newSubWips = new Whip(subWhipEval);

			that.subWhips.push(
				{
					attachNum : subWhipEval.attachNum,
					whip      : newSubWips
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
			}else if(subDefName ==='textureName'){
				subWhip.whip[subDefName] = subDef;
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

			var particle = 'particleA',
				attachNum = subWhip.attachNum;

			//attach to the last particle
			if (subWhip.attachNum == this.linkCount+1){
				particle = 'particleB';
				attachNum -= 1;

			}

			if(!_.isUndefined(this.links[attachNum])) {
				this.links[attachNum].layerIndex = subWhip.layerIndex;

				subWhip.whip.links[0]['particleA'].position.x = that.links[attachNum][particle].position.x;
				subWhip.whip.links[0]['particleA'].position.y = that.links[attachNum][particle].position.y;
				subWhip.whip.links[0].angleFixed = that.links[attachNum].angle + subWhip.whip.angleStart;
			}



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

Whip.prototype.spriteDeform = function(options) {
	const nbHorizontalControlPoints = this.controlPoints.length/2;
    // Create sections
	this.sections = [];
	for(let i=0; i< nbHorizontalControlPoints-1; i++)
    this.sections.push([
        this.controlPoints[0+i*2],
        this.controlPoints[2+i*2],
        this.controlPoints[3+i*2],
        this.controlPoints[1+i*2],
    ]);
		
    // Cut the texture of the sections
    let subTextures = [];
	if (this.texture) {
		for (let i=0 ; i < nbHorizontalControlPoints-1; i++){
		  subTextures.push(new PIXI.Texture(this.texture, new PIXI.Rectangle(
			i * this.texture.baseTexture.width / (nbHorizontalControlPoints-1),
			0,
			this.texture.baseTexture.width / (nbHorizontalControlPoints-1),
			this.texture.baseTexture.height
		  )));
		}
	}
		
	if (subTextures.length > 1) {
		this.cuttedSprites =  _.times(nbHorizontalControlPoints, (i) => new PIXI.projection.Sprite2s(subTextures[i]));
	}
	
	return this;
}

Whip.prototype.updateGraphic = function( ctx ) {
	
	if (_.isUndefined(this.container) ) {return;}
	
	this.mygraph.clear();
	
	var position   = this.links[0].particleA.position,
		scale      = this.width;
           
        this.container.x     	= position.x;
        this.container.y     	= position.y;
		
		// Update controls points
		 for ( var len = this.links.length, i=len-1; i >= 0; i-- ) {
			var link        = this.links[i],
				easingRatio = this.lineShape.getEasing(1, i / this.linkCount ),
                vector = new Vector({a: link.particleA.position.copy(), b: link.particleB.position.copy()});
				vector.orthoRotate({from: 'center'});
				vector.scaleFromUnit({f:scale * easingRatio});
					

				
				this.controlPoints[((len-1)-i)*2].x = vector.a.x - this.container.x;
				this.controlPoints[((len-1)-i)*2].y = vector.a.y - this.container.y;
				
				this.controlPoints[((len-1)-i)*2+1].x = vector.b.x - this.container.x;
				this.controlPoints[((len-1)-i)*2+1].y = vector.b.y - this.container.y;
				
				
				//debug
				/*
				this.mygraph.lineStyle(1, 0xffffff);
				if (i==0) {
					this.mygraph.lineStyle(1, 0xff0000);
				}
				this.mygraph.moveTo( link.particleA.position.x,  link.particleA.position.y);
				this.mygraph.lineTo( link.particleB.position.x,  link.particleB.position.y);
				
		        this.mygraph.moveTo(vector.a.x, vector.a.y);
		        this.mygraph.lineTo(vector.b.x, vector.b.y);
				*/
				
				/*
				let text = new PIXI.Text('a',{fontFamily : 'Arial', fontSize: 10, fill : 0xff1010, align : 'center', anchor:0.5});
				text.x = vector.a.x - this.container.x;
				text.y = vector.a.y - this.container.y;
				//this.container.addChild(text);
				*/
				
		}
	
}


Whip.prototype.render = function( ctx ) {


    if(this.renderBody){
		var that = this;
        var position   = this.links[0].particleA.position,
            scale      = this.width;// / faceTexture.width;
            //scale      = 2 / faceTexture.width;
		this.container 	   = new PIXI.Container();	
		//this.container.removeChildren();
		
       //  var strip   = new PIXI.mesh.Plane(tentacleTexture, 2, 2/*this.links.length*/);

        this.container.x     	= position.x;
        this.container.y     	= position.y;


        this.stage.addChild(this.container);
		this.stage.addChild(this.mygraph);
		
		// Create controls points
		this.controlPoints = [];
		 for ( var len = this.links.length, i=len-1; i >= 0; i-- ) {
			var link      = this.links[i],
                vector = new Vector({a: link.particleA.position.copy(), b: link.particleB.position.copy()});
				vector.orthoRotate({from: 'center'});
				vector.scaleFromUnit({f:scale});
				
				this.controlPoints.push({
					x: vector.a.x - this.container.x,
					y: vector.a.y - this.container.y
				});
				this.controlPoints.push({
					x: vector.b.x - this.container.x,
					y: vector.b.y - this.container.y
				});

		}

		if (this.textureName) {
			this.texture = this.loadedResource[this.textureName].texture;
		}
		this.spriteDeform();
		
		//Add sprites to snakeContainer
		_.each(this.cuttedSprites, (cuttedSprite) => {
			that.container.addChild(cuttedSprite);
			//app.stage.addChild(cuttedSprite);
		 });

    }
};


Whip.prototype.renderO = function( ctx ) {
  if(this.renderBody){
    for ( var len = this.links.length, i=len-1; i >= 0; i-- ) {
        var link = this.links[i];

        var position = link.particleB.position,
            palette    = new Palette(this.paletteName).setLineShape(this.lineShape).getColor(i/this.linkCount),
	        color      = colorToHex(palette),
            scale      =  this.lineShape.getEasing(this.width, i / this.linkCount) / faceTexture.width,
            faceSprite = new PIXI.Sprite(faceTexture);

        faceSprite.anchor.set(0.5);
        faceSprite.x        = position.x;
		faceSprite.y        = position.y;
		faceSprite.rotation = link.angle;
        faceSprite.tint  	= color;
        faceSprite.alpha  	= palette.transparency;
        faceSprite.scale 	= new PIXI.Point(scale,scale); //(width, width);

        app.stage.addChild(faceSprite);

/*
	graphics.lineStyle(1, color, palette.transparency );
	graphics.beginFill(color, palette.transparency );
	graphics.drawCircle(position.x, position.y ,this.lineShape.getEasing(this.width, i / this.linkCount )); // drawCircle(x, y, radius)
	graphics.endFill();
*/
      //circle( ctx, position.x, position.y , this.lineShape.getEasing(this.width, i / this.linkCount ), color);

    var position   = this.links[0].particleA.position,
        palette    = new Palette(this.paletteName).setLineShape(this.lineShape).getColor(0),
	    color      = colorToHex(palette),
        scale      = this.lineShape.getEasing(this.width, 0 ) / faceTexture.width,
        faceSprite = new PIXI.Sprite(faceTexture);

        faceSprite.anchor.set(0.5);
        faceSprite.x     	= position.x;
        faceSprite.y     	= position.y;
		faceSprite.rotation = this.links[0].angle;
        faceSprite.tint  	= color;
        faceSprite.alpha 	 = palette.transparency;
        faceSprite.scale	 = new PIXI.Point(scale,scale); //(width, width);

        app.stage.addChild(faceSprite);

/*
	graphics.lineStyle(1, color, palette.transparency );
	graphics.beginFill(color, palette.transparency );
	graphics.drawCircle(position.x, position.y ,this.lineShape.getEasing(this.width, 0 )); // drawCircle(x, y, radius)
	graphics.endFill();
*/
    //circle( ctx, position.x, position.y ,this.lineShape.getEasing(this.width, 0 ), color );

    }
  }

/*
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
	*/

};

export {Whip};