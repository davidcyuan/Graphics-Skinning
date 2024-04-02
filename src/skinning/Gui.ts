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
  public highlight: number;
  // public bone_index: number;
  private boneDragging: boolean;

  public time: number;
  public mode: Mode;

  public hoverX: number = 0;
  public hoverY: number = 0;

  private default_z: number = 69;

  // private key_frame_one: Mat4[];
  private key_frames: Mat4[][];


  private starting_key: Mat4[];
  private starting_time: number;
  private animating: boolean;
  private ending_key_index: number;

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
    this.highlight = -1.0;
    this.selectedBone = -1;
    this.animation = animation;

    this.key_frames = [];
    this.starting_key = [];
    this.starting_time = -1;
    this.animating = false;
    this.ending_key_index = -1;
    
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
    this.highlight = -1.0;
    this.selectedBone = -1;
    this.starting_key = [];
    this.starting_time = 0;
    this.animating = false;
    this.key_frames = [];

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
    if(this.selectedBone > -0.5){
      this.boneDragging = true;
    }
    // if(bone_index >-0.5){
    //   this.selectedBone = bone_index;
    // }
    // this.rotate_bone(0, mouse.offsetX, mouse.offsetY);
    //
    
    this.dragging = true;
    if(this.highlight != -1.0){
      //logic for rotations
    }
    this.prevX = mouse.screenX;
    this.prevY = mouse.screenY;
    // console.log("screenX: ")
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
    // this.selectedBone = this.updateHighlightedBone(x, y);

    // console.log(this.boneDragging);
    
    if(this.dragging == false && this.boneDragging == false){
      // console.log("here");
      this.selectedBone = this.updateHighlightedBone(x, y);
    }

    if (this.dragging) {
      if(this.boneDragging){
        this.rotate_bone(this.selectedBone, x, y);
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

  public rotate_bone(bone_index: number, mouseX: number, mouseY): void{
    let view_matrix: Mat4 = this.viewMatrix();
    let inverse_view_matrix: Mat4 = new Mat4();
    view_matrix.inverse(inverse_view_matrix);

    let proj_matrix: Mat4 = this.projMatrix();
    let inverse_proj_matrix: Mat4 = new Mat4();
    proj_matrix.inverse(inverse_proj_matrix);

    //get bone NDC
    let bone_position_NDC: Vec3 = this.animation.get_bone_position(bone_index);
    bone_position_NDC = view_matrix.my_mult_vec3(bone_position_NDC);
    bone_position_NDC = proj_matrix.my_mult_vec3(bone_position_NDC);

    let bone_endpoint_NDC: Vec3 = this.animation.get_bone_endpoint(bone_index);
    bone_endpoint_NDC = view_matrix.my_mult_vec3(bone_endpoint_NDC);
    bone_endpoint_NDC = proj_matrix.my_mult_vec3(bone_endpoint_NDC);
    // console.log(bone_endpoint_NDC.copy());

    let new_E_proj: Vec3 = this.mouse_to_NDC_point(mouseX, mouseY);
    // console.log(new_E_proj.copy());
    // console.log(bone_position_NDC);

    //get 3 rotation points in NDC
    let center: Vec3 = new Vec3([bone_position_NDC.x, bone_position_NDC.y, -1]);
    let old: Vec3 = new Vec3([bone_endpoint_NDC.x, bone_endpoint_NDC.y, -1]);
    let neww: Vec3 = new Vec3([new_E_proj.x, new_E_proj.y, -1]);

    //conver to camera???
    center = inverse_proj_matrix.my_mult_vec3(center);
    old = inverse_proj_matrix.my_mult_vec3(old);
    neww = inverse_proj_matrix.my_mult_vec3(neww);

    let vec_center_old: Vec3 = new Vec3();
    old.subtract(center, vec_center_old);
    vec_center_old.normalize();

    let vec_center_neww: Vec3 = new Vec3();
    neww.subtract(center, vec_center_neww);
    vec_center_neww.normalize();

    let axis: Vec3 = Vec3.cross(vec_center_old, vec_center_neww);
    axis.normalize();
    let dot_product: number = Vec3.dot(vec_center_old, vec_center_neww);
    let cross_product_length: number = Vec3.cross(vec_center_old, vec_center_neww).length();
    let angle: number = Math.atan2(cross_product_length, dot_product);

    //convert axis from camera to world
    axis = inverse_view_matrix.multiplyVec3(axis);

    this.animation.rotate_bone(bone_index, axis, angle);



    // let new_E_view: Vec3 = inverse_proj_matrix.my_mult_vec3(new_E_proj);
    // // let new_E_view: Vec3 = new Vec3([1, 1, -7]);

    // let new_E_world: Vec3 = inverse_view_matrix.my_mult_vec3(new_E_view);
    // this.animation.target_rotation(bone_index, new_E_world);    
  }
  
  public animate(): void{
    if(this.animating){
      let start_time: number = this.starting_time;
      let end_time: number = start_time + 1000;
      let total_time: number = 1000;
      let current_time: number = new Date().getTime();
      
      if(current_time < end_time){
        let delta: number = (current_time - start_time) / total_time;
        let slerp_key: Mat4[] = [];
        for(var bone_index = 0; bone_index < this.starting_key.length; bone_index++){
          let start_rotation_i: Mat4 = this.starting_key[bone_index];
          let end_rotation_i: Mat4 = this.key_frames[this.ending_key_index][bone_index];
  
          let start_quat: Quat = start_rotation_i.get_rotation_Quat();
          let end_quat: Quat = end_rotation_i.get_rotation_Quat();
          let slerp_quat: Quat = Quat.slerpShort(start_quat, end_quat, delta);
          let slerp_rotation: Mat4 = slerp_quat.toMat4();
          slerp_key[bone_index] = slerp_rotation;
        }

        // this.animation.set_key_frame(this.key_frame_one);
        this.animation.set_key_frame(slerp_key);
      }
      else{
        this.ending_key_index++;
        if(this.ending_key_index < this.key_frames.length){
          //next bone
          this.starting_time = new Date().getTime();
          this.starting_key = this.animation.get_key_frame();
        }
        else{
          this.starting_time = -1;
          this.starting_key = [];
          this.ending_key_index = -1;
          this.animating = false;
        }
        
      }
    }
  }

  public onKeydown(key: KeyboardEvent): void {
    switch (key.code) {
      case "KeyK": {
        // this.key_frame_one = this.animation.get_key_frame();
        this.key_frames.push(this.animation.get_key_frame());
        break;
      }
      case "KeyY": {
        this.animation.set_key_frame(this.key_frames[0]);
        break;
      }
      case "KeyP": {
        //animate to key_frame_one
        if(this.key_frames.length > 0){
          this.starting_key = this.animation.get_key_frame();
          this.starting_time = new Date().getTime();
          this.ending_key_index = 0;
          this.animating = true;
        }
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
        if(this.selectedBone > -0.5){
          //here
          // console.log("roll")
          this.animation.roll_bone(this.selectedBone, GUI.rollSpeed, false);
        }
        else{
          this.camera.roll(GUI.rollSpeed, false);
          // break;
        }
        break;
      }
      case "ArrowRight": {
        //TODO: Handle bone rolls when a bone is selected
        if(this.selectedBone > -0.5){
          //here
          // console.log("roll");
          this.animation.roll_bone(this.selectedBone, GUI.rollSpeed, true);
        }
        else{
          this.camera.roll(GUI.rollSpeed, true);
          // break;
        }
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
      // case "KeyP": {
      //   if (this.mode === Mode.edit && this.getNumKeyFrames() > 1)
      //   {
      //     this.mode = Mode.playback;
      //     this.time = 0;
      //   } else if (this.mode === Mode.playback) {
      //     this.mode = Mode.edit;
      //   }
      //   break;
      // }
      // default: {
      //   console.log("Key : '", key.code, "' was pressed.");
      //   break;
      // }
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
  public mouse_to_NDC_point(mouseX: number, mouseY): Vec3 {
    const x = (2 * mouseX) / this.width - 1;
    const y = 1 - (2 * mouseY) / this.viewPortHeight;
    return new Vec3([x, y, -1]);
    // const mouseNormal = new Vec4([x, y, -1, 1]);
    // const mouseCamera = this.projMatrix().inverse().multiplyVec4(mouseNormal);
    // mouseCamera.scale(1 / mouseCamera.w);
    // return new Vec3([mouseCamera.x, mouseCamera.y, mouseCamera.z]);
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

public updateHighlightedBone(mouseX: number, mouseY: number): number {
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
  // console.log("found a highlighted bone at");
  // console.log(closestBoneIndex);
  this.highlight = closestBoneIndex;
  return closestBoneIndex;
}

}
