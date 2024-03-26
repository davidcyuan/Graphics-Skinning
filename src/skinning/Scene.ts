import { Mat4, Quat, Vec3 } from "../lib/TSM.js";
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
  public position: Vec3; // current position of the bone's joint *in world coordinates*. Used by the provided skeleton shader, so you need to keep this up to date.
  public endpoint: Vec3; // current position of the bone's second (non-joint) endpoint, in world coordinates
  public rotation: Quat; // current orientation of the joint *with respect to world coordinates*

  constructor(bone: BoneLoader) {
    this.parent = bone.parent;
    this.children = Array.from(bone.children);
    this.position = bone.position.copy();
    //testtt
    // this.position = new Vec3([0, 0, 0]);
    this.endpoint = bone.endpoint.copy();
    this.rotation = bone.rotation.copy();
  }

  public get_position(): Vec3{
    return this.position.copy();
  }
  public set_position(position: Vec3): void{
    this.position = position;
  }
  public get_rotation(): Quat{
    return this.rotation.copy();
  }
  public set_rotation(rotation: Quat): void{
    this.rotation = rotation;
  }
  public get_endpoint(): Vec3{
    return this.endpoint.copy();
  }
  public set_endpoint(endpoint: Vec3): void{
    this.endpoint = endpoint;
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
      // if(bone_count == 1){
      //   let new_position: Vec3 = new Vec3([0,1,1]);
      //   pushed_bone.set_position(new_position);
      // }
      this.bones.push(pushed_bone);
      bone_count += 1;
    });
    // console.log(bone_count);
    this.materialName = mesh.materialName;
    this.imgSrc = null;
    this.boneIndices = Array.from(mesh.boneIndices);
    this.bonePositions = new Float32Array(mesh.bonePositions);
    this.boneIndexAttribute = new Float32Array(mesh.boneIndexAttribute);
  }

  //testtt function
  public test_rotate(rotation_world: Quat): void{
    let original_bone: Bone = this.bones[1];

    // let axis: Vec3 = new Vec3([1, 0, 0]);
    // let angle: number = Math.PI / 4;
    // let rotation: Quat = Quat.fromAxisAngle(axis, angle);
    let original_rotation: Quat = original_bone.get_rotation();
    let composed_rotation: Quat = new Quat();
    rotation_world.multiply(original_rotation, composed_rotation);
    original_bone.set_rotation(composed_rotation);

    // console.log(original_bone.get_position());
  }
  public test_set_endpoint(endpoint_world: Vec3): void{
    this.bones[1].set_endpoint(endpoint_world);
  }
  //TODO: Create functionality for bone manipulation/key-framing

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
      let res = bone.position.xyz;
      for (let i = 0; i < res.length; i++) {
        trans[3 * index + i] = res[i];
      }
    });
    return trans;
  }

  public getBoneRotations(): Float32Array {
    let trans = new Float32Array(4 * this.bones.length);
    this.bones.forEach((bone, index) => {
      let res = bone.rotation.xyzw;
      for (let i = 0; i < res.length; i++) {
        trans[4 * index + i] = res[i];
      }
    });
    return trans;
  }
}