import { Debugger } from "../lib/webglutils/Debugging.js";
import {
  CanvasAnimation,
  WebGLUtilities
} from "../lib/webglutils/CanvasAnimation.js";
import { Floor } from "../lib/webglutils/Floor.js";
import { GUI, Mode } from "./Gui.js";
import {
  sceneFSText,
  sceneVSText,
  floorFSText,
  floorVSText,
  skeletonFSText,
  skeletonVSText,
  sBackVSText,
  sBackFSText,
  sideVSText, 
  sideFSText

} from "./Shaders.js";
import { Mat4, Vec4, Vec3, Quat} from "../lib/TSM.js";
import { CLoader } from "./AnimationFileLoader.js";
import { RenderPass } from "../lib/webglutils/RenderPass.js";
import { Camera } from "../lib/webglutils/Camera.js";


export class SkinningAnimation extends CanvasAnimation {
  private gui: GUI;
  private millis: number;

  private loadedScene: string;

  /* Floor Rendering Info */
  private floor: Floor;
  private floorRenderPass: RenderPass;

  /* Scene rendering info */
  private scene: CLoader;
  private sceneRenderPass: RenderPass;

  /* Skeleton rendering info */
  private skeletonRenderPass: RenderPass;


  /* Scrub bar background rendering info */
  private sBackRenderPass: RenderPass;
  
  /* Global Rendering Info */
  private lightPosition: Vec4;
  private backgroundColor: Vec4;

  /* Keyframe info */
  private sideBarPass: RenderPass;
  private keyframeTextures: WebGLTexture[] = [];

  private canvas2d: HTMLCanvasElement;
  private ctx2: CanvasRenderingContext2D | null;


  constructor(canvas: HTMLCanvasElement) {
    super(canvas);

    this.canvas2d = document.getElementById("textCanvas") as HTMLCanvasElement;
    this.ctx2 = this.canvas2d.getContext("2d");
    if (this.ctx2) {
      this.ctx2.font = "25px serif";
      this.ctx2.fillStyle = "#ffffffff";
    }

    this.ctx = Debugger.makeDebugContext(this.ctx);
    let gl = this.ctx;

    this.floor = new Floor();

    this.floorRenderPass = new RenderPass(this.extVAO, gl, floorVSText, floorFSText);
    this.sceneRenderPass = new RenderPass(this.extVAO, gl, sceneVSText, sceneFSText);
    this.skeletonRenderPass = new RenderPass(this.extVAO, gl, skeletonVSText, skeletonFSText);
    this.sideBarPass = new RenderPass(this.extVAO, gl, sideVSText, sideFSText);

	//TODO: Add in other rendering initializations for other shaders such as bone highlighting

    this.gui = new GUI(this.canvas2d, this);
    this.lightPosition = new Vec4([-10, 10, -10, 1]);
    this.backgroundColor = new Vec4([0.0, 0.37254903, 0.37254903, 1.0]);

    this.initFloor();
    this.scene = new CLoader("");

    // Status bar
    this.sBackRenderPass = new RenderPass(this.extVAO, gl, sBackVSText, sBackFSText);
    
    this.initGui();
	
    this.millis = new Date().getTime();
  }

  public get_bone_position(bone_index: number): Vec3{
    return this.scene.get_bone_position(bone_index);
  }
  public get_bone_endpoint(bone_index: number): Vec3{
    return this.scene.get_bone_endpoint(bone_index);
  }
  public rotate_bone(bone_index: number, axis: Vec3, angle: number): void{
    this.scene.rotate_bone(bone_index, axis, angle);
  }
  public roll_bone(bone_index: number, angle: number, axis_sign: boolean){
    this.scene.roll_bone(bone_index, angle, axis_sign);
  }
  public translate_bone(bone_index: number, translation_world: Vec3):void{
    this.scene.translate_bone(bone_index, translation_world);
  }

  public get_key_frame(): Mat4[]{
    return this.scene.get_key_frame();
  }
  public set_key_frame(key_frame: Mat4[]): void{
    this.scene.set_key_frame(key_frame);
  }

  public getScene(): CLoader {
    return this.scene;
  }

  /**
   * Setup the animation. This can be called again to reset the animation.
   */
  public reset(): void {
      this.gui.reset();
      this.setScene(this.loadedScene);
  }

  public initGui(): void {
    
    // Status bar background
    let verts = new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]);
    this.sBackRenderPass.setIndexBufferData(new Uint32Array([1, 0, 2, 2, 0, 3]))
    this.sBackRenderPass.addAttribute("vertPosition", 2, this.ctx.FLOAT, false,
      2 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, verts);

    this.sBackRenderPass.setDrawData(this.ctx.TRIANGLES, 6, this.ctx.UNSIGNED_INT, 0);
    this.sBackRenderPass.setup();

    }

  public initScene(): void {
    if (this.scene.meshes.length === 0) { return; }
    this.initModel();
    this.initSkeleton();
    this.gui.reset();
  }

  /**
   * Sets up the mesh and mesh drawing
   */
  public initModel(): void {
    this.sceneRenderPass = new RenderPass(this.extVAO, this.ctx, sceneVSText, sceneFSText);

    let faceCount = this.scene.meshes[0].geometry.position.count / 3;
    let fIndices = new Uint32Array(faceCount * 3);
    for (let i = 0; i < faceCount * 3; i += 3) {
      fIndices[i] = i;
      fIndices[i + 1] = i + 1;
      fIndices[i + 2] = i + 2;
    }    
    this.sceneRenderPass.setIndexBufferData(fIndices);

	//vertPosition is a placeholder value until skinning is in place
    this.sceneRenderPass.addAttribute("vertPosition", 3, this.ctx.FLOAT, false,
    3 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.scene.meshes[0].geometry.position.values);
    this.sceneRenderPass.addAttribute("aNorm", 3, this.ctx.FLOAT, false,
      3 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.scene.meshes[0].geometry.normal.values);
    if (this.scene.meshes[0].geometry.uv) {
      this.sceneRenderPass.addAttribute("aUV", 2, this.ctx.FLOAT, false,
        2 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.scene.meshes[0].geometry.uv.values);
    } else {
      this.sceneRenderPass.addAttribute("aUV", 2, this.ctx.FLOAT, false,
        2 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, new Float32Array(this.scene.meshes[0].geometry.normal.values.length));
    }
	
	//Note that these attributes will error until you use them in the shader
    this.sceneRenderPass.addAttribute("skinIndices", 4, this.ctx.FLOAT, false,
      4 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.scene.meshes[0].geometry.skinIndex.values);
    this.sceneRenderPass.addAttribute("skinWeights", 4, this.ctx.FLOAT, false,
      4 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.scene.meshes[0].geometry.skinWeight.values);
    this.sceneRenderPass.addAttribute("v0", 3, this.ctx.FLOAT, false,
      3 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.scene.meshes[0].geometry.v0.values);
    this.sceneRenderPass.addAttribute("v1", 3, this.ctx.FLOAT, false,
      3 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.scene.meshes[0].geometry.v1.values);
    this.sceneRenderPass.addAttribute("v2", 3, this.ctx.FLOAT, false,
      3 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.scene.meshes[0].geometry.v2.values);
    this.sceneRenderPass.addAttribute("v3", 3, this.ctx.FLOAT, false,
      3 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.scene.meshes[0].geometry.v3.values);

    this.sceneRenderPass.addUniform("lightPosition",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniform4fv(loc, this.lightPosition.xyzw);
    });
    this.sceneRenderPass.addUniform("mWorld",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniformMatrix4fv(loc, false, new Float32Array(new Mat4().setIdentity().all()));
    });
    this.sceneRenderPass.addUniform("mProj",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.projMatrix().all()));
    });
    this.sceneRenderPass.addUniform("mView",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.viewMatrix().all()));
    });
    this.sceneRenderPass.addUniform("jTrans",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniform3fv(loc, this.scene.meshes[0].getBoneTranslations());
    });
    this.sceneRenderPass.addUniform("jRots",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniform4fv(loc, this.scene.meshes[0].getBoneRotations());
    });

    this.sceneRenderPass.setDrawData(this.ctx.TRIANGLES, this.scene.meshes[0].geometry.position.count, this.ctx.UNSIGNED_INT, 0);
    this.sceneRenderPass.setup();
  }
 
  /**
   * Sets up the skeleton drawing
   */
  public initSkeleton(): void {
    this.skeletonRenderPass.setIndexBufferData(this.scene.meshes[0].getBoneIndices());

    this.skeletonRenderPass.addAttribute("vertPosition", 3, this.ctx.FLOAT, false,
      3 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.scene.meshes[0].getBonePositions());
    this.skeletonRenderPass.addAttribute("boneIndex", 1, this.ctx.FLOAT, false,
      1 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.scene.meshes[0].getBoneIndexAttribute());

    this.skeletonRenderPass.addUniform("mWorld",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniformMatrix4fv(loc, false, new Float32Array(Mat4.identity.all()));
    });
    this.skeletonRenderPass.addUniform("mProj",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.projMatrix().all()));
    });
    this.skeletonRenderPass.addUniform("mView",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.viewMatrix().all()));
    });
    this.skeletonRenderPass.addUniform("bTrans",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniform3fv(loc, this.getScene().meshes[0].getBoneTranslations());
    });
    this.skeletonRenderPass.addUniform("bRots",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniform4fv(loc, this.getScene().meshes[0].getBoneRotations());
    });
    this.skeletonRenderPass.addUniform("bHighlight",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        if(this.getGUI().highlight != -1.0){
          // console.log(this.getGUI().highlight);
          gl.uniform1f(loc, this.getGUI().highlight);
        }
        else{
            gl.uniform1f(loc, -1);
        }
    });
    this.skeletonRenderPass.setDrawData(this.ctx.LINES,
      this.scene.meshes[0].getBoneIndices().length, this.ctx.UNSIGNED_INT, 0);
    this.skeletonRenderPass.setup();
  }

  	//TODO: Set up a Render Pass for the bone highlighting

  /**
   * Sets up the floor drawing
   */
  public initFloor(): void {
    this.floorRenderPass.setIndexBufferData(this.floor.indicesFlat());
    this.floorRenderPass.addAttribute("aVertPos",
      4,
      this.ctx.FLOAT,
      false,
      4 * Float32Array.BYTES_PER_ELEMENT,
      0,
      undefined,
      this.floor.positionsFlat()
    );

    this.floorRenderPass.addUniform("uLightPos",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniform4fv(loc, this.lightPosition.xyzw);
    });
    this.floorRenderPass.addUniform("uWorld",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniformMatrix4fv(loc, false, new Float32Array(Mat4.identity.all()));
    });
    this.floorRenderPass.addUniform("uProj",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.projMatrix().all()));
    });
    this.floorRenderPass.addUniform("uView",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.viewMatrix().all()));
    });
    this.floorRenderPass.addUniform("uProjInv",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.projMatrix().inverse().all()));
    });
    this.floorRenderPass.addUniform("uViewInv",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.viewMatrix().inverse().all()));
    });

    this.floorRenderPass.setDrawData(this.ctx.TRIANGLES, this.floor.indicesFlat().length, this.ctx.UNSIGNED_INT, 0);
    this.floorRenderPass.setup();
  }


  /** @internal
   * Draws a single frame
   *
   */
  public draw(): void {
    // console.log("drawing:");
    this.getGUI().animate();

    // Update skeleton state
    let curr = new Date().getTime();
    let deltaT = curr - this.millis;
    this.millis = curr;
    deltaT /= 1000;
    this.getGUI().incrementTime(deltaT);

	//TODO: Handle mesh playback if implementing for project spec

    if (this.ctx2) {
      this.ctx2.clearRect(0, 0, this.ctx2.canvas.width, this.ctx2.canvas.height);
      if (this.scene.meshes.length > 0) {
        this.ctx2.fillText(this.getGUI().getModeString(), 50, 710);
      }
    }

    // Drawing
    const gl: WebGLRenderingContext = this.ctx;
    const bg: Vec4 = this.backgroundColor;
    gl.clearColor(bg.r, bg.g, bg.b, bg.a);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.frontFace(gl.CCW);
    gl.cullFace(gl.BACK);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null); // null is the default frame buffer
    this.drawScene(0, 200, 800, 600); 
    this.drawKeyframes();   

    /* Draw status bar */
    if (this.scene.meshes.length > 0) {
      gl.viewport(0, 0, 800, 200);
      this.sBackRenderPass.draw();      
    }    

  }

  private drawScene(x: number, y: number, width: number, height: number): void {
    const gl: WebGLRenderingContext = this.ctx;
    gl.viewport(x, y, width, height);

    this.floorRenderPass.draw();

    /* Draw Scene */
    if (this.scene.meshes.length > 0) {
      this.sceneRenderPass.draw();
      gl.disable(gl.DEPTH_TEST);
      this.skeletonRenderPass.draw();
	  //TODO: Add functionality for drawing the highlighted bone when necessary
      gl.enable(gl.DEPTH_TEST);      
    }
  }

  public getGUI(): GUI {
    return this.gui;
  }
  
  /**
   * Loads and sets the scene from a Collada file
   * @param fileLocation URI for the Collada file
   */
  public setScene(fileLocation: string): void {
    this.loadedScene = fileLocation;
    this.scene = new CLoader(fileLocation);
    this.scene.load(() => this.initScene());
  }

  public createTextureForFrame(keyframe: Mat4[]){
    const targetTexture = this.ctx.createTexture();
      this.ctx.bindTexture(this.ctx.TEXTURE_2D, targetTexture);
  
      this.ctx.texImage2D(this.ctx.TEXTURE_2D, 0, this.ctx.RGBA, 800, 600, 0, this.ctx.RGBA, this.ctx.UNSIGNED_BYTE, null);
      this.ctx.texParameteri(this.ctx.TEXTURE_2D, this.ctx.TEXTURE_MIN_FILTER, this.ctx.LINEAR);
      this.ctx.texParameteri(this.ctx.TEXTURE_2D, this.ctx.TEXTURE_WRAP_S, this.ctx.CLAMP_TO_EDGE);
      this.ctx.texParameteri(this.ctx.TEXTURE_2D, this.ctx.TEXTURE_WRAP_T, this.ctx.CLAMP_TO_EDGE);
    
      // Bind the FBO and attach the texture to it
      const fb = this.ctx.createFramebuffer();

      //const renderPass = new RenderPass(this.extVAO, this.ctx, sideVSText, sideFSText);

      /*let verts = new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]);
      renderPass.setIndexBufferData(new Uint32Array([1, 0, 2, 2, 0, 3]))
      renderPass.addAttribute("vertPosition", 2, this.ctx.FLOAT, false,
        2 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, verts);
  
      renderPass.setDrawData(this.ctx.TRIANGLES, 6, this.ctx.UNSIGNED_INT, 0);
      renderPass.setup();
      renderPass.draw();*/

      this.ctx.bindFramebuffer(this.ctx.FRAMEBUFFER, fb);
      this.ctx.framebufferTexture2D(this.ctx.FRAMEBUFFER, this.ctx.COLOR_ATTACHMENT0, this.ctx.TEXTURE_2D, targetTexture, 0);
      this.ctx.clearColor(0, 0, 0, 1); // Set clear color to black
      this.ctx.clear(this.ctx.COLOR_BUFFER_BIT | this.ctx.DEPTH_BUFFER_BIT);
      if(targetTexture != null){
        this.keyframeTextures.push(targetTexture);
      }

   }

   private drawToTexture(): void{

   }



  private drawKeyframes(): void {
    const gl: WebGLRenderingContext = this.ctx;
    const previewWidth = 320; // Width of the preview panel
    const previewHeight = 800; // Height of the preview panel
    const previewProjectionMatrix = Mat4.orthographic(-previewWidth / 2, previewWidth / 2, -previewHeight / 2, previewHeight / 2, -1, 1);
  
    // Set up a new RenderPass for drawing the keyframe textures
    const keyframeRenderPass = new RenderPass(this.extVAO, gl,sideVSText, sideFSText);
  
    // Set up vertex data for a quad
    let verts = new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]);
    keyframeRenderPass.setIndexBufferData(new Uint32Array([1, 0, 2, 2, 0, 3]))
    keyframeRenderPass.addAttribute("vertPosition", 2, this.ctx.FLOAT, false,
        2 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, verts);
      
  
    // Set up index buffer for quad indices
  
    // Set draw data for the quad
    keyframeRenderPass.setDrawData(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0);
  

    // Draw each keyframe texture vertically in the preview panel
    let yOffset = 600;
    const keyframes = this.getGUI().getKeyFrames();

    for (let i = 0; i < keyframes.length; i++) {
      const texture = this.keyframeTextures[i];
      gl.viewport(800, yOffset, previewWidth, 200);
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      keyframeRenderPass.addUniform("uProjection", (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniformMatrix4fv(loc, false, new Float32Array(previewProjectionMatrix.all()));
        
    });
    keyframeRenderPass.addUniform("uTexture", (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
      gl.uniform1i(loc, i);
  });
  keyframeRenderPass.addUniform("bColor",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
          // console.log(this.getGUI().highlight);
          gl.uniform1f(loc, i / 4);

    });

  //   this.set_key_frame(keyframes[i]);

  // // Render the scene to the texture
  //   this.drawScene(800, yOffset, 320, 200);
  
    keyframeRenderPass.setup();
    keyframeRenderPass.draw();
      yOffset -= 200;
    }
  }
}

export function initializeCanvas(): void {
  const canvas = document.getElementById("glCanvas") as HTMLCanvasElement;
  /* Start drawing */
  canvas.width += 320;
  const canvasAnimation: SkinningAnimation = new SkinningAnimation(canvas);
  canvasAnimation.start();
  canvasAnimation.setScene("./static/assets/skinning/split_cube.dae");
}
