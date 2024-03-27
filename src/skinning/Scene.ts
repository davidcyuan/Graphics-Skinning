import { Mat4, Quat, Vec3, Vec4 } from "../lib/TSM.js";
import { AttributeLoader, MeshGeometryLoader, BoneLoader, MeshLoader } from "./AnimationFileLoader.js";

//TODO: Generate cylinder geometry for highlighting bones

//General class for handling GLSL attributes
export class Attribute {
  values: Float32Array;
  count: number;
  itemSize: number;

  constructor(attr: AttributeLoader) {
    this.values = attr.values;
    this.count = attr.count;
    this.itemSize = attr.itemSize;
  }
}

//Class for handling mesh vertices and skin weights
export class MeshGeometry {
  position: Attribute;
  normal: Attribute;
  uv: Attribute | null;
  skinIndex: Attribute; // bones indices that affect each vertex
  skinWeight: Attribute; // weight of associated bone
  v0: Attribute; // position of each vertex of the mesh *in the coordinate system of bone skinIndex[0]'s joint*. Perhaps useful for LBS.
  v1: Attribute;
  v2: Attribute;
  v3: Attribute;

  constructor(mesh: MeshGeometryLoader) {
    this.position = new Attribute(mesh.position);
    this.normal = new Attribute(mesh.normal);
    if (mesh.uv) { this.uv = new Attribute(mesh.uv); }
    this.skinIndex = new Attribute(mesh.skinIndex);
    this.skinWeight = new Attribute(mesh.skinWeight);
    this.v0 = new Attribute(mesh.v0);
    this.v1 = new Attribute(mesh.v1);
    this.v2 = new Attribute(mesh.v2);
    this.v3 = new Attribute(mesh.v3);
  }
}

//Class for handling bones in the skeleton rig
export class Bone {
  public parent: number;
  public children: number[];
  //starting position, current position should be pulled from D
  // public position_world: Vec3; // current position of the bone's joint *in world coordinates*. Used by the provided skeleton shader, so you need to keep this up to date.
  //starting endpoint
  // public endpoint: Vec3; // current position of the bone's second (non-joint) endpoint, in world coordinates
  public position_local: Vec3;
  public endpoint_local: Vec3;
  public rotation_local: Mat4;
  //current rotation, we are assuming the starting rotation is the Identity rotation
  // public rotation: Quat; // current orientation of the joint *with respect to world coordinates*
  // public D: Mat4;
  public starting_position_world: Vec3;
  public translation_parent_this: Mat4
  public parent_D: Mat4;
  // public TR: Mat4;
  public deprecated_endpoint;

  constructor(bone: BoneLoader) {
    this.parent = bone.parent;
    this.children = Array.from(bone.children);
    this.position_local = new Vec3();
    this.deprecated_endpoint = bone.endpoint.copy();

    this.starting_position_world = bone.position.copy();
    this.endpoint_local = new Vec3();
    bone.endpoint.copy().subtract(this.starting_position_world, this.endpoint_local);

    let starting_rotation = bone.rotation.copy();
    //check
    this.rotation_local = starting_rotation.toMat4();

    //depreicated to be
    this.deprecated_endpoint = bone.endpoint.copy();
  }
  //gets translation matrices
  public constructor_2(bones: Bone[]){
    if(this.parent < -0.5){
      //no parent
      this.translation_parent_this = new Mat4().setIdentity();
      this.translation_parent_this.set_position_Vec3(this.starting_position_world);
      this.parent_D = new Mat4().setIdentity();
    }
    else{
      // has parent
      let vec_parent_this: Vec3 = new Vec3;
      this.starting_position_world.subtract(bones[this.parent].starting_position_world, vec_parent_this);
      this.translation_parent_this = new Mat4().setIdentity();
      this.translation_parent_this.set_position_Vec3(vec_parent_this);
      // this.parent_D = bones[this.parent].get_D();
    }
  }

  public propogate(bones: Bone[]):void{
    if(this.parent < -0.5){
      this.parent_D = new Mat4().setIdentity();
    }
    else{
      this.parent_D = bones[this.parent].get_D();
    }
    for(var children_index in this.children){
      let child_index: number = this.children[children_index];
      bones[child_index].propogate(bones);
    }
  }

  // public propogate(bones: Bone[], parent?: Bone): void{
  //   if(!parent){
  //     //root
  //   }
  //   else{
  //     //get T
  //     let translation_parent_this: Vec3 = new Vec3();
  //     this.get_original_position().subtract(parent.get_original_position(), translation_parent_this);
  //     //get TR
  //     let TR: Mat4 = this.D.copy();
  //     TR.setIdentity();
  //     TR.set_position_Vec3(translation_parent_this);

  //     let parent_D: Mat4 = parent.get_D();
  //     let new_D: Mat4 = new Mat4();
  //     parent_D.multiply(TR, new_D);
  //     this.D = new_D;


  //     //get local endpoint
  //     // this.endpoint.subtract(this.get_position(), local_endpoint);
  //     // let local_endpoint_h: Vec4 = new Vec4([local_endpoint.x, local_endpoint.y, local_endpoint.z, 1]);
  //     //get TR
  //     // let translation_parent_this: Vec3 = new Vec3();
  //     // this.get_position().subtract(parent.get_position(), translation_parent_this);
  //     // let TR: Mat4 = this.D.copy();
  //     // TR.set_position_Vec3(translation_parent_this);
      
  //     // let new_D: Mat4 = parent.get_D();
  //     // new_D.multiply(TR);
  //     // this.D = new_D;
      
  //     // let new_endpoint_h: Vec4 = this.D.multiplyVec4(local_endpoint_h);
  //     // let w: number = new_endpoint_h.w;
  //     // this.endpoint = new Vec3([new_endpoint_h.x/w, new_endpoint_h.y/w, new_endpoint_h.z/w]);
  //     //should equal this.get_position() + local
  //   }
  //   for(var children_index in this.children){
  //     // if(this.children.length <=0){
  //     //   break;
  //     // }
  //     console.log("made it here");
  //     bones[this.children[children_index]].propogate(bones, this);
  //   }
  // }

  public get_D(): Mat4{
    //D
    let D: Mat4 = this.parent_D.copy();
    //D*T
    D.multiply(this.translation_parent_this);
    //D*T*R
    D.multiply(this.rotation_local);
    return D;
  }
  public get_position(): Vec3{
    return this.get_D().get_position_Vec3();
  }

  public get_rotation(): Quat{
    return this.get_D().get_rotation_Quat().copy();
  }
  // public apply_local_rotation(rotation: Quat, bones: Bone[]): void{

  //   let composed_rotation: Quat = new Quat();
  //   rotation.multiply(this.get_rotation(), composed_rotation);
  //   // this.rotation = composed_rotation;

  //   let new_D: Mat4 = composed_rotation.toMat4();
  //   new_D.set_position_Vec3(this.get_position());
  //   this.D = new_D;
  //   this.propogate(bones);
  // }
  public target_rotation(target_world: Vec3): void{
    //convert target to local coordiantes
    // console.log(target_world);
    let parent_D_inverse: Mat4 = this.parent_D.copy().inverse();
    let T_inverse: Mat4 = this.translation_parent_this.copy().inverse();
    // let R_inverse: Mat4 = this.rotation_local.copy().inverse();


    let target_local: Vec3 = parent_D_inverse.my_mult_vec3(target_world);
    target_local = T_inverse.my_mult_vec3(target_local);
    // target_local = R_inverse.my_mult_vec3(target_local);
    // console.log(target_local);

    //(0,0,0)
    let position_local: Vec3 = new Vec3();
    
    let vec_position_endpoint: Vec3 = new Vec3();
    this.endpoint_local.subtract(position_local, vec_position_endpoint);
    vec_position_endpoint.normalize();

    let vec_position_target: Vec3 = new Vec3();
    target_local.subtract(position_local, vec_position_target);
    vec_position_target.normalize();

    let axis: Vec3 = Vec3.cross(vec_position_endpoint, vec_position_target);
    axis.normalize();

    let dot_product: number = Vec3.dot(vec_position_endpoint, vec_position_target);
    let cross_product_length: number = Vec3.cross(vec_position_endpoint, vec_position_target).length();
    let angle: number = Math.atan2(cross_product_length, dot_product);
    let new_rotation: Quat = Quat.fromAxisAngle(axis, angle);

    this.rotation_local = new_rotation.toMat4();
    // this.propogate(bones);
  }
  public get_endpoint(): Vec3{
    return this.deprecated_endpoint.copy();
    // return this.D.my_mult_vec3(this.endpoint_local).copy();
    // return new Vec3();
  }
  //deprecated
  // public set_endpoint(endpoint: Vec3): void{
  //   // this.endpoint = endpoint;
  // }
}

//Class for handling the overall mesh and rig
export class Mesh {
  public geometry: MeshGeometry;
  public worldMatrix: Mat4; // in this project all meshes and rigs have been transformed into world coordinates for you
  public rotation: Vec3;
  public bones: Bone[];
  public materialName: string;
  public imgSrc: String | null;

  private boneIndices: number[];
  private bonePositions: Float32Array;
  private boneIndexAttribute: Float32Array;

  constructor(mesh: MeshLoader) {
    this.geometry = new MeshGeometry(mesh.geometry);
    this.worldMatrix = mesh.worldMatrix.copy();
    this.rotation = mesh.rotation.copy();
    this.bones = [];
    //testtt
    let bone_count = 0;
    mesh.bones.forEach(bone => {
      // console.log(bone_count);
      let pushed_bone: Bone = new Bone(bone)
      // if(bone_count == 1){
      //   let new_position: Vec3 = new Vec3([1,2,1]);
      //   pushed_bone.set_position(new_position);
      // }
      this.bones.push(pushed_bone);
      bone_count += 1;
    });
    //construct translation matricies
    for(var bone_index in this.bones){
      let bone: Bone = this.bones[bone_index];
      bone.constructor_2(this.bones);
    }
    //propgate parents
    for(var bone_index in this.bones){
      let bone: Bone = this.bones[bone_index];
      //no parent
      if(bone.parent < -0.5){
        bone.propogate(this.bones);
      }
    }
    this.materialName = mesh.materialName;
    this.imgSrc = null;
    this.boneIndices = Array.from(mesh.boneIndices);
    this.bonePositions = new Float32Array(mesh.bonePositions);
    this.boneIndexAttribute = new Float32Array(mesh.boneIndexAttribute);

    //ttt
    // this.bones[1].propogate(this.bones);
  }

  public target_rotation(bone_index: number, target_world: Vec3){
    this.bones[bone_index].target_rotation(target_world);
    this.bones[bone_index].propogate(this.bones);
  }

  public getBoneIndices(): Uint32Array {
    return new Uint32Array(this.boneIndices);
  }

  public getBonePositions(): Float32Array {
    return this.bonePositions;
  }

  public getBoneIndexAttribute(): Float32Array {
    return this.boneIndexAttribute;
  }

  public getBoneTranslations(): Float32Array {
    let trans = new Float32Array(3 * this.bones.length);
    this.bones.forEach((bone, index) => {
      // let res = bone.position.xyz;
      let res = bone.get_position().xyz;
      for (let i = 0; i < res.length; i++) {
        trans[3 * index + i] = res[i];
      }
    });
    return trans;
  }

  public getBoneRotations(): Float32Array {
    let trans = new Float32Array(4 * this.bones.length);
    this.bones.forEach((bone, index) => {
      // let res = bone.rotation.xyzw;
      let res = bone.get_rotation().xyzw;
      for (let i = 0; i < res.length; i++) {
        trans[4 * index + i] = res[i];
      }
    });
    return trans;
  }
}