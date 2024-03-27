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
  public original_position: Vec3; // current position of the bone's joint *in world coordinates*. Used by the provided skeleton shader, so you need to keep this up to date.
  //starting endpoint
  // public endpoint: Vec3; // current position of the bone's second (non-joint) endpoint, in world coordinates
  public endpoint_local: Vec3;
  //current rotation, we are assuming the starting rotation is the Identity rotation
  // public rotation: Quat; // current orientation of the joint *with respect to world coordinates*
  public D: Mat4;

  constructor(bone: BoneLoader) {
    this.parent = bone.parent;
    this.children = Array.from(bone.children);
    this.original_position = bone.position.copy();
    
    // this.endpoint = bone.endpoint.copy();
    this.endpoint_local = new Vec3();
    bone.endpoint.copy().subtract(this.original_position, this.endpoint_local);
    // this.rotation = bone.rotation.copy();

    this.D = bone.rotation.copy().toMat4();
    this.D.set_position_Vec3(this.original_position);
  }

  public propogate(bones: Bone[], parent?: Bone): void{
    if(!parent){
      //root
    }
    else{
      //get T
      let translation_parent_this: Vec3 = new Vec3();
      this.get_original_position().subtract(parent.get_original_position(), translation_parent_this);
      //get TR
      let TR: Mat4 = this.D.copy();
      TR.setIdentity();
      TR.set_position_Vec3(translation_parent_this);

      let parent_D: Mat4 = parent.get_D();
      let new_D: Mat4 = new Mat4();
      parent_D.multiply(TR, new_D);
      this.D = new_D;


      //get local endpoint
      // this.endpoint.subtract(this.get_position(), local_endpoint);
      // let local_endpoint_h: Vec4 = new Vec4([local_endpoint.x, local_endpoint.y, local_endpoint.z, 1]);
      //get TR
      // let translation_parent_this: Vec3 = new Vec3();
      // this.get_position().subtract(parent.get_position(), translation_parent_this);
      // let TR: Mat4 = this.D.copy();
      // TR.set_position_Vec3(translation_parent_this);
      
      // let new_D: Mat4 = parent.get_D();
      // new_D.multiply(TR);
      // this.D = new_D;
      
      // let new_endpoint_h: Vec4 = this.D.multiplyVec4(local_endpoint_h);
      // let w: number = new_endpoint_h.w;
      // this.endpoint = new Vec3([new_endpoint_h.x/w, new_endpoint_h.y/w, new_endpoint_h.z/w]);
      //should equal this.get_position() + local
    }
    for(var children_index in this.children){
      // if(this.children.length <=0){
      //   break;
      // }
      console.log("made it here");
      bones[this.children[children_index]].propogate(bones, this);
    }
  }

  public get_D(): Mat4{
    return this.D.copy();
  }
  public get_original_position(): Vec3{
    return this.original_position;
  }

  public get_position(): Vec3{
    return this.D.get_position_Vec3();
    // return this.get_starting_position().copy();
  }

  public get_rotation(): Quat{
    return this.D.get_rotation_Quat().copy();
    // return this.rotation.copy();
  }
  public apply_local_rotation(rotation: Quat, bones: Bone[]): void{

    let composed_rotation: Quat = new Quat();
    rotation.multiply(this.get_rotation(), composed_rotation);
    // this.rotation = composed_rotation;

    let new_D: Mat4 = composed_rotation.toMat4();
    new_D.set_position_Vec3(this.get_position());
    this.D = new_D;
    this.propogate(bones);
  }
  public get_endpoint(): Vec3{
    // return this.endpoint.copy();
    return this.D.my_mult_vec3(this.endpoint_local).copy();
  }
  //deprecated
  public set_endpoint(endpoint: Vec3): void{
    // this.endpoint = endpoint;
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
      // console.log(bone_count);
      let pushed_bone: Bone = new Bone(bone)
      // if(bone_count == 1){
      //   let new_position: Vec3 = new Vec3([1,2,1]);
      //   pushed_bone.set_position(new_position);
      // }
      this.bones.push(pushed_bone);
      bone_count += 1;
    });
    this.materialName = mesh.materialName;
    this.imgSrc = null;
    this.boneIndices = Array.from(mesh.boneIndices);
    this.bonePositions = new Float32Array(mesh.bonePositions);
    this.boneIndexAttribute = new Float32Array(mesh.boneIndexAttribute);

    //ttt
    this.bones[1].propogate(this.bones);
  }

  //testtt functio
  public apply_local_rotation(rotation: Quat): void{
    this.bones[1].apply_local_rotation(rotation, this.bones);
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