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

  public position_local: Vec3;
  public endpoint_local: Vec3;
  public rotation_local: Mat4;
  public translation_local: Mat4;
  public parent_D: Mat4;

  public starting_position_world: Vec3;

  constructor(bone: BoneLoader) {
    this.parent = bone.parent;
    this.children = Array.from(bone.children);
    this.position_local = new Vec3();

    this.starting_position_world = bone.position.copy();
    this.endpoint_local = new Vec3();
    bone.endpoint.copy().subtract(this.starting_position_world, this.endpoint_local);

    let starting_rotation: Quat = bone.rotation.copy();
    this.rotation_local = starting_rotation.toMat4();
  }
  //gets translation matrices
  public constructor_2(bones: Bone[]){
    if(this.parent < -0.5){
      //no parent
      this.translation_local = new Mat4().setIdentity();
      this.translation_local.set_position_Vec3(this.starting_position_world);
      this.parent_D = new Mat4().setIdentity();
    }
    else{
      // has parent
      let vec_parent_this: Vec3 = new Vec3;
      this.starting_position_world.subtract(bones[this.parent].starting_position_world, vec_parent_this);
      this.translation_local = new Mat4().setIdentity();
      this.translation_local.set_position_Vec3(vec_parent_this);
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

  public get_D(): Mat4{
    //D
    let D: Mat4 = this.parent_D.copy();
    //D*T
    D.multiply(this.translation_local);
    //D*T*R
    D.multiply(this.rotation_local);
    return D;
  }
  //world position of starting point
  public get_position(): Vec3{
    return this.get_D().get_position_Vec3();
  }
  //world rotation
  public get_rotation(): Quat{
    return this.get_D().get_rotation_Quat().copy();
  }

  public rotate(axis: Vec3, angle: number){
    let inverse_D: Mat4 = new Mat4;
    this.get_D().copy().inverse(inverse_D);

    let axis_local: Vec3 = inverse_D.multiplyVec3(axis);
    let local_rotation: Quat = Quat.fromAxisAngle(axis_local, angle);
    let local_rotation_mat: Mat4 = local_rotation.toMat4();

    let new_local_rotation: Mat4 = new Mat4();
    this.rotation_local.multiply(local_rotation_mat, new_local_rotation);
    this.rotation_local = new_local_rotation;
  }
  public translate(trans_world: Vec3){
    //convert to local translation
    let inverse_D: Mat4 = new Mat4();
    //!!! wrong, account for local rotation
    this.get_D().copy().inverse(inverse_D);

    let trans_local: Vec3 = inverse_D.multiplyVec3(trans_world);
    let trans_local_mat: Mat4 = new Mat4().setIdentity();
    trans_local_mat.set_position_Vec3(trans_local);

    let new_trans_local: Mat4 = new Mat4();
    this.translation_local.multiply(trans_local_mat, new_trans_local);
    this.translation_local = new_trans_local;
  }
  public roll(angle: number, axis_sign: boolean): void{
    let axis_local: Vec3 = new Vec3([this.endpoint_local.x, this.endpoint_local.y, this.endpoint_local.z]);
    axis_local.normalize();
    if(axis_sign == false){
      axis_local.scale(-1);
    }
    let local_rotation: Quat = Quat.fromAxisAngle(axis_local, angle);
    let local_rotation_mat: Mat4 = local_rotation.toMat4();

    let new_local_rotation: Mat4 = new Mat4();
    this.rotation_local.multiply(local_rotation_mat, new_local_rotation);
    this.rotation_local = new_local_rotation;
  }
  public get_endpoint(): Vec3{
    return this.get_D().my_mult_vec3(this.endpoint_local);
  }

  //return local rotation
  public get_local_rotation(): Mat4{
    return this.rotation_local.copy();
  }
  //remember to propogate!!
  public set_local_rotation(local_rotation: Mat4, bones: Bone[]): void{
    this.rotation_local = local_rotation.copy();
    this.propogate(bones);
  }
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
      let pushed_bone: Bone = new Bone(bone)
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
  public rotate_bone(bone_index: number, axis: Vec3, angle: number){
    this.bones[bone_index].rotate(axis, angle);
    this.bones[bone_index].propogate(this.bones);
  }
  public translate_bone(bone_index: number, trans_world: Vec3): void{
    this.bones[bone_index].translate(trans_world);
    this.bones[bone_index].propogate(this.bones);
  }
  public roll_bone(bone_index: number, angle: number, axis_sign: boolean): void{
    this.bones[bone_index].roll(angle, axis_sign);
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

  //keyframes
  public get_local_rotations(): Mat4[]{
    let local_rotations: Mat4[] = [];
    for(var bone_index = 0; bone_index < this.bones.length; bone_index++){
      local_rotations.push(this.bones[bone_index].get_local_rotation());
    }
    return local_rotations;
  }
  public set_local_rotations(local_rotations: Mat4[]): void{
    for(var bone_index = 0; bone_index < this.bones.length; bone_index++){
      this.bones[bone_index].set_local_rotation(local_rotations[bone_index].copy(), this.bones);
    }
  }
}