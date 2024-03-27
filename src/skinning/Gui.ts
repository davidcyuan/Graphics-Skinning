import { Camera } from "../lib/webglutils/Camera.js";
import { CanvasAnimation } from "../lib/webglutils/CanvasAnimation.js";
import { SkinningAnimation } from "./App.js";
import { Mat4, Vec3, Vec4, Vec2, Mat2, Quat } from "../lib/TSM.js";
import { Bone } from "./Scene.js";
import { RenderPass } from "../lib/webglutils/RenderPass.js";

/**
 * Might be useful for designing any animation GUI
 */
interface IGUI {
  viewMatrix(): Mat4;
  projMatrix(): Mat4;
  dragStart(me: MouseEvent): void;
  drag(me: MouseEvent): void;
  dragEnd(me: MouseEvent): void;
  onKeydown(ke: KeyboardEvent): void;
}

export enum Mode {
  playback,  
  edit  
}

	
/**
 * Handles Mouse and Button events along with
 * the the camera.
 */

export class GUI implements IGUI {
  private static readonly rotationSpeed: number = 0.05;
  private static readonly zoomSpeed: number = 0.1;
  private static readonly rollSpeed: number = 0.1;
  private static readonly panSpeed: number = 0.1;

  private camera: Camera;
  private dragging: boolean;
  private fps: boolean;
  private prevX: number;
  private prevY: number;

  private height: number;
  private viewPortHeight: number;
  private width: number;

  private animation: SkinningAnimation;

  private selectedBone: number;
  private highlight: any;
  private boneDragging: boolean;

  public time: number;
  public mode: Mode;

  public hoverX: number = 0;
  public hoverY: number = 0;

  private default_z: number = 69;


  /**
   *
   * @param canvas required to get the width and height of the canvas
   * @param animation required as a back pointer for some of the controls
   * @param sponge required for some of the controls
   */
  constructor(canvas: HTMLCanvasElement, animation: SkinningAnimation) {
    this.height = canvas.height;
    this.viewPortHeight = this.height - 200;
    this.width = canvas.width;
    this.prevX = 0;
    this.prevY = 0;
    
    this.animation = animation;
    
    this.reset();
    
    this.registerEventListeners(canvas);
  }

  public getNumKeyFrames(): number {
    //TODO: Fix for the status bar in the GUI
    return 0;
  }
  
  public getTime(): number { 
  	return this.time; 
  }
  
  public getMaxTime(): number { 
    //TODO: The animation should stop after the last keyframe
    return 0;
  }

  /**
   * Resets the state of the GUI
   */
  public reset(): void {
    this.fps = false;
    this.dragging = false;
    this.time = 0;
	this.mode = Mode.edit;
    
    this.camera = new Camera(
      new Vec3([0, 0, -6]),
      new Vec3([0, 0, 0]),
      new Vec3([0, 1, 0]),
      45,
      this.width / this.viewPortHeight,
      0.1,
      1000.0
    );
  }

  /**
   * Sets the GUI's camera to the given camera
   * @param cam a new camera
   */
  public setCamera(
    pos: Vec3,
    target: Vec3,
    upDir: Vec3,
    fov: number,
    aspect: number,
    zNear: number,
    zFar: number
  ) {
    this.camera = new Camera(pos, target, upDir, fov, aspect, zNear, zFar);
  }

  /**
   * Returns the view matrix of the camera
   */
  public viewMatrix(): Mat4 {
    return this.camera.viewMatrix();
  }

  /**
   * Returns the projection matrix of the camera
   */
  public projMatrix(): Mat4 {
    return this.camera.projMatrix();
  }

  /**
   * Callback function for the start of a drag event.
   * @param mouse
   */
  public dragStart(mouse: MouseEvent): void {
    if (mouse.offsetY > 600) {
      // outside the main panel
      return;
    }
	
    // TODO: Add logic to rotate the bones, instead of moving the camera, if there is a currently highlighted bone
    this.updateHighlightedBone(mouse.offsetX, mouse.offsetY);
    
    this.dragging = true;
    this.prevX = mouse.screenX;
    this.prevY = mouse.screenY;
    console.log("screenX: ")
  }

  public incrementTime(dT: number): void {
    if (this.mode === Mode.playback) {
      this.time += dT;
      if (this.time >= this.getMaxTime()) {
        this.time = 0;
        this.mode = Mode.edit;
      }
    }
  }
  

  /**
   * The callback function for a drag event.
   * This event happens after dragStart and
   * before dragEnd.
   * @param mouse
   */
  public drag(mouse: MouseEvent): void {
    let x = mouse.offsetX;
    let y = mouse.offsetY;
    if (this.dragging) {
      if(this.boneDragging){
        //add rotation logic here
      } else{
      const dx = mouse.screenX - this.prevX;
      const dy = mouse.screenY - this.prevY;
      this.prevX = mouse.screenX;
      this.prevY = mouse.screenY;

      /* Left button, or primary button */
      const mouseDir: Vec3 = this.camera.right();
      mouseDir.scale(-dx);
      mouseDir.add(this.camera.up().scale(dy));
      mouseDir.normalize();

      if (dx === 0 && dy === 0) {
        return;
      }

      switch (mouse.buttons) {
        case 1: {
          let rotAxis: Vec3 = Vec3.cross(this.camera.forward(), mouseDir);
          rotAxis = rotAxis.normalize();

          if (this.fps) {
            this.camera.rotate(rotAxis, GUI.rotationSpeed);
          } else {
            this.camera.orbitTarget(rotAxis, GUI.rotationSpeed);
          }
          break;
        }
        case 2: {
          /* Right button, or secondary button */
          this.camera.offsetDist(Math.sign(mouseDir.y) * GUI.zoomSpeed);
          break;
        }
        default: {
          break;
        }
      }
    }
    } 
    // TODO: Add logic here:
    // 1) To highlight a bone, if the mouse is hovering over a bone;
    // 2) To rotate a bone, if the mouse button is pressed and currently highlighting a bone.
  }
  
 
  public getModeString(): string {
    switch (this.mode) {
      case Mode.edit: { return "edit: " + this.getNumKeyFrames() + " keyframes"; }
      case Mode.playback: { return "playback: " + this.getTime().toFixed(2) + " / " + this.getMaxTime().toFixed(2); }
    }
  }
  
  /**
   * Callback function for the end of a drag event
   * @param mouse
   */
  public dragEnd(mouse: MouseEvent): void {
    this.dragging = false;
    this.prevX = 0;
    this.prevY = 0;
    this.boneDragging = false;
    this.highlight = -1;
    this.selectedBone = -1
    // TODO: Handle ending highlight/dragging logic as needed
  }

  /**
   * Callback function for a key press event
   * @param key
   */
  public onKeydown(key: KeyboardEvent): void {
    switch (key.code) {
      //testtting key
      case "KeyT": {
        //get bone[1]'s position
        
        let view_matrix: Mat4 = this.viewMatrix();
        let inverse_view_matrix: Mat4 = new Mat4();
        view_matrix.inverse(inverse_view_matrix);
        // let inverse_proj_matrix: Mat4 = new Mat4();

        let bone_E_world: Vec3 = this.animation.get_bone_1_end();
        // let bone_E_world_h: Vec4 = new Vec4([bone_E_world.x, bone_E_world.y, bone_E_world.z, 1]);
        // let bone_E_view: Vec4 = view_matrix.multiplyVec4(bone_E_world_h);

        // let new_E_view: Vec4 = new Vec4([1, 1, bone_E_view.z, 1]);
        let new_E_view: Vec4 = new Vec4([1, 1, -7, 1]);
        let new_E_world_h: Vec4 = inverse_view_matrix.multiplyVec4(new_E_view);
        let new_E_world: Vec3 = new Vec3([new_E_world_h.x, new_E_world_h.y, new_E_world_h.z]);

        let bone_O_world: Vec3 = this.animation.get_bone_1_position();

        let vec_OE: Vec3 = new Vec3();
        bone_E_world.subtract(bone_O_world, vec_OE);
        vec_OE.normalize();

        let vec_ON: Vec3 = new Vec3();
        new_E_world.subtract(bone_O_world, vec_ON);
        vec_ON.normalize();

        let raw_axis: Vec3 = Vec3.cross(vec_OE, vec_ON);

        let axis: Vec3 = new Vec3();
        raw_axis.normalize(axis);

        let dot_product: number = Vec3.dot(vec_OE, vec_ON);
        let cross_product_length: number = raw_axis.length();
        let angle: number = Math.atan2(cross_product_length, dot_product);
        

        let rotation_world: Quat = Quat.fromAxisAngle(axis, angle);
        this.animation.apply_local_rotation(rotation_world);
        // this.animation.test_set_endpoint(new_E_world);

        break;
      }
      case "Digit1": {
        this.animation.setScene("./static/assets/skinning/split_cube.dae");
        break;
      }
      case "Digit2": {
        this.animation.setScene("./static/assets/skinning/long_cubes.dae");
        break;
      }
      case "Digit3": {
        this.animation.setScene("./static/assets/skinning/simple_art.dae");
        break;
      }      
      case "Digit4": {
        this.animation.setScene("./static/assets/skinning/mapped_cube.dae");
        break;
      }
      case "Digit5": {
        this.animation.setScene("./static/assets/skinning/robot.dae");
        break;
      }
      case "Digit6": {
        this.animation.setScene("./static/assets/skinning/head.dae");
        break;
      }
      case "Digit7": {
        this.animation.setScene("./static/assets/skinning/wolf.dae");
        break;
      }
      case "KeyW": {
        this.camera.offset(
            this.camera.forward().negate(),
            GUI.zoomSpeed,
            true
          );
        break;
      }
      case "KeyA": {
        this.camera.offset(this.camera.right().negate(), GUI.zoomSpeed, true);
        break;
      }
      case "KeyS": {
        this.camera.offset(this.camera.forward(), GUI.zoomSpeed, true);
        break;
      }
      case "KeyD": {
        this.camera.offset(this.camera.right(), GUI.zoomSpeed, true);
        break;
      }
      case "KeyR": {
        this.animation.reset();
        break;
      }
      case "ArrowLeft": {
		//TODO: Handle bone rolls when a bone is selected
		this.camera.roll(GUI.rollSpeed, false);
        break;
      }
      case "ArrowRight": {
		//TODO: Handle bone rolls when a bone is selected
		this.camera.roll(GUI.rollSpeed, true);
        break;
      }
      case "ArrowUp": {
        this.camera.offset(this.camera.up(), GUI.zoomSpeed, true);
        break;
      }
      case "ArrowDown": {
        this.camera.offset(this.camera.up().negate(), GUI.zoomSpeed, true);
        break;
      }
      case "KeyK": {
        if (this.mode === Mode.edit) {
		//TODO: Add keyframes if required by project spec
        }
        break;
      }      
      case "KeyP": {
        if (this.mode === Mode.edit && this.getNumKeyFrames() > 1)
        {
          this.mode = Mode.playback;
          this.time = 0;
        } else if (this.mode === Mode.playback) {
          this.mode = Mode.edit;
        }
        break;
      }
      default: {
        console.log("Key : '", key.code, "' was pressed.");
        break;
      }
    }
  }

  /**
   * Registers all event listeners for the GUI
   * @param canvas The canvas being used
   */
  private registerEventListeners(canvas: HTMLCanvasElement): void {
    /* Event listener for key controls */
    window.addEventListener("keydown", (key: KeyboardEvent) =>
      this.onKeydown(key)
    );

    /* Event listener for mouse controls */
    canvas.addEventListener("mousedown", (mouse: MouseEvent) =>
      this.dragStart(mouse)
    );

    canvas.addEventListener("mousemove", (mouse: MouseEvent) =>
      this.drag(mouse)
    );

    canvas.addEventListener("mouseup", (mouse: MouseEvent) =>
      this.dragEnd(mouse)
    );

    /* Event listener to stop the right click menu */
    canvas.addEventListener("contextmenu", (event: any) =>
      event.preventDefault()
    );
  }

  public screen_to_world_ray(mouseX: number, mouseY): Vec3 {
    const x = (2 * mouseX) / this.width - 1;
    const y = 1 - (2 * mouseY) / this.viewPortHeight;
    const mouseNormal = new Vec4([x, y, -1, 1]);
    const mouseWorld = this.viewMatrix().inverse().multiplyVec4(this.projMatrix().inverse().multiplyVec4(mouseNormal));
    mouseWorld.scale(1 / mouseWorld.w);
    const ray = Vec3.difference(new Vec3(mouseWorld.xyz), this.camera.pos()).normalize();
    return ray;
  }

  public intersectCylinder(bone: Bone, cameraPosition: Vec3, rayDirection: Vec3) {
    const radius = .1; 
    const boneStart = new Vec3([bone.get_position().x, bone.get_position().y, bone.get_position().z]);
    const boneEnd = new Vec3([bone.get_endpoint().x, bone.get_endpoint().y, bone.get_endpoint().z]);
    const boneDirection = Vec3.difference(boneEnd, boneStart).normalize();
    const boneLength = Vec3.distance(boneEnd, boneStart);

    // Calculate ray origin and direction
    const rayOrigin = new Vec3(cameraPosition.xyz);
    const rayDir = new Vec3(rayDirection.xyz);

    // Vector from ray origin to cylinder start
    const startToRayOrigin = Vec3.difference(rayOrigin, boneStart);

    const dirCrossBoneDir = Vec3.cross(rayDir, boneDirection);
    const startToOriginCrossBoneDir = Vec3.cross(startToRayOrigin, boneDirection);

    // Compute terms used in quadratic equation
    const a = dirCrossBoneDir.squaredLength();
    const b = 2 * Vec3.dot(dirCrossBoneDir, startToOriginCrossBoneDir);
    const c = startToOriginCrossBoneDir.squaredLength() - radius * radius;
    // Solve quadratic equation
    const discriminant = Math.pow(b, 2) - 4 * a * c;
    if (discriminant < 0) {
        return -1; // No intersection
    }

    // Find the closest intersection point
    const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
    const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);
    const t = (t1 < t2) ? t1 : t2; // Use the smaller positive t value
    const intersectionPoint1 = new Vec3([
      rayOrigin.x + rayDir.x * t1,
      rayOrigin.y + rayDir.y * t1,
      rayOrigin.z + rayDir.z * t1
  ]);
  
  const intersectionPoint2 = new Vec3([
    rayOrigin.x + rayDir.x * t2,
    rayOrigin.y + rayDir.y * t2,
    rayOrigin.z + rayDir.z * t2
  ]);

  if (t1 > 0.00001 && Vec3.dot(boneDirection, Vec3.difference(intersectionPoint1, boneStart)) >= 0 && Vec3.dot(boneDirection, Vec3.difference(intersectionPoint2, boneEnd)) <= 0)
    return t1;
  
  if (t2 > 0.00001 && Vec3.dot(boneDirection, Vec3.difference(intersectionPoint2, boneStart)) >= 0 && Vec3.dot(boneDirection, Vec3.difference(intersectionPoint2, boneEnd)) <= 0)
    return t2;

  return -1;

}

public updateHighlightedBone(mouseX: number, mouseY: number): void {
  const rayDirection = this.screen_to_world_ray(mouseX, mouseY);

  let closestBoneIndex = -1;
  let closestIntersection = Number.MAX_VALUE;

  for (let i = 0; i < this.animation.getScene().meshes.length; i++) {
      for (let j = 0; j < this.animation.getScene().meshes[i].bones.length; j++) {
          const bone = this.animation.getScene().meshes[i].bones[j];
          const intersection = this.intersectCylinder(bone, this.camera.pos(), rayDirection);
          if (intersection !== -1 && intersection < closestIntersection) {
              closestIntersection = intersection;
              closestBoneIndex = j;
          }
      }
  }
  console.log("found a highlighted bone at");
  console.log(closestBoneIndex);
  this.highlight = closestBoneIndex;
}

}
