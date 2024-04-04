export const floorVSText = `
    precision mediump float;

    uniform vec4 uLightPos;
    uniform mat4 uWorld;
    uniform mat4 uView;
    uniform mat4 uProj;
    
    attribute vec4 aVertPos;

    varying vec4 vClipPos;

    void main () {

        gl_Position = uProj * uView * uWorld * aVertPos;
        vClipPos = gl_Position;
    }
`;

export const floorFSText = `
    precision mediump float;

    uniform mat4 uViewInv;
    uniform mat4 uProjInv;
    uniform vec4 uLightPos;

    varying vec4 vClipPos;

    void main() {
        vec4 wsPos = uViewInv * uProjInv * vec4(vClipPos.xyz/vClipPos.w, 1.0);
        wsPos /= wsPos.w;
        /* Determine which color square the position is in */
        float checkerWidth = 5.0;
        float i = floor(wsPos.x / checkerWidth);
        float j = floor(wsPos.z / checkerWidth);
        vec3 color = mod(i + j, 2.0) * vec3(1.0, 1.0, 1.0);

        /* Compute light fall off */
        vec4 lightDirection = uLightPos - wsPos;
        float dot_nl = dot(normalize(lightDirection), vec4(0.0, 1.0, 0.0, 0.0));
	    dot_nl = clamp(dot_nl, 0.0, 1.0);
	
        gl_FragColor = vec4(clamp(dot_nl * color, 0.0, 1.0), 1.0);
    }
`;

export const sceneVSText = `
    precision mediump float;

	//Placeholder value for passing through undeformed verts 
	//(should be discarded in final version of shader)
    attribute vec3 vertPosition;
	
    attribute vec2 aUV;
    attribute vec3 aNorm;
    attribute vec4 skinIndices;
    attribute vec4 skinWeights;
	
	//vertices used for bone weights (assumes up to four weights per vertex)
    attribute vec4 v0;
    attribute vec4 v1;
    attribute vec4 v2;
    attribute vec4 v3;
    
    varying vec4 lightDir;
    varying vec2 uv;
    varying vec4 normal;
 
    uniform vec4 lightPosition;
    uniform mat4 mWorld;
    uniform mat4 mView;
    uniform mat4 mProj;

	//Joint translations and rotations to determine weights (assumes up to 64 joints per rig)
    uniform vec3 jTrans[64];
    uniform vec4 jRots[64];

    vec3 qtrans(vec4 q, vec3 v) {
        return v.xyz + 2.0 * cross(cross(v.xyz, q.xyz) - q.w*v, q.xyz);
        //return v;
    }
        


    void main () {
        int bone_index_0 = int(skinIndices[0]);
        vec4 v0_deformed = vec4(jTrans[bone_index_0] + qtrans(jRots[bone_index_0], v0.xyz), 1.0);
        // vec3 v0_vec3 = v0_deformed.xyz / v0_deformed.w;
        int bone_index_1 = int(skinIndices[1]);
        vec4 v1_deformed = vec4(jTrans[bone_index_1] + qtrans(jRots[bone_index_1], v1.xyz), 1.0);
        // vec3 v1_vec3 = v1_deformed.xyz / v1_deformed.w;
        int bone_index_2 = int(skinIndices[2]);
        vec4 v2_deformed = vec4(jTrans[bone_index_2] + qtrans(jRots[bone_index_2], v2.xyz), 1.0);
        // vec3 v2_vec3 = v2_deformed.xyz / v2_deformed.w;
        int bone_index_3 = int(skinIndices[3]);
        vec4 v3_deformed = vec4(jTrans[bone_index_3] + qtrans(jRots[bone_index_3], v3.xyz), 1.0);
        // vec3 v3_vec3 = v3_deformed.xyz / v3_deformed.w;

        vec4 blended = skinWeights[0] * v0_deformed + skinWeights[1] * v1_deformed + skinWeights[2] * v2_deformed + skinWeights[3] * v3_deformed;
        

        // vec3 trans = vertPosition;
        // vec4 trans = blended;
        vec4 worldPosition = blended;

        gl_Position = mProj * mView * worldPosition;
        //  Compute light direction and transform to camera coordinates
        lightDir = lightPosition - worldPosition;
        
        vec4 aNorm4 = vec4(aNorm, 0.0);
        normal = normalize(mWorld * vec4(aNorm, 0.0));
    
        uv = aUV;
    }

`;
export const sceneFSText = `
    precision mediump float;

    varying vec4 lightDir;
    varying vec2 uv;
    varying vec4 normal;

    void main () {
        gl_FragColor = vec4((normal.x + 1.0)/2.0, (normal.y + 1.0)/2.0, (normal.z + 1.0)/2.0,1.0);
    }
`;



export const skeletonVSText = `
    precision mediump float;

    attribute vec3 vertPosition;
    attribute float boneIndex;
    uniform float bHighlight;
    
    uniform mat4 mWorld;
    uniform mat4 mView;
    uniform mat4 mProj;

    uniform vec3 bTrans[64];
    uniform vec4 bRots[64];

    varying float highlight;

    vec3 qtrans(vec4 q, vec3 v) {
        return v + 2.0 * cross(cross(v, q.xyz) - q.w*v, q.xyz);
    }

    void main () {
        int index = int(boneIndex);
        gl_Position = mProj * mView * mWorld * vec4(bTrans[index] + qtrans(bRots[index], vertPosition), 1.0);
        if(int(bHighlight) != index){
            highlight = 0.0;
        } 
        else {
            highlight = 1.0;
        }
    }
`;

export const skeletonFSText = `
    precision mediump float;
    varying float highlight;
    void main () {
        gl_FragColor = vec4(1.0, highlight, 0.0, 1.0);
    }
`;

	
export const sBackVSText = `
    precision mediump float;

    attribute vec2 vertPosition;

    varying vec2 uv;

    void main() {
        gl_Position = vec4(vertPosition, 0.0, 1.0);
        uv = vertPosition;
        uv.x = (1.0 + uv.x) / 2.0;
        uv.y = (1.0 + uv.y) / 2.0;
    }
`;

export const sBackFSText = `
    precision mediump float;

    varying vec2 uv;

    void main () {
        gl_FragColor = vec4(0.1, 0.1, 0.1, 1.0);
        if (abs(uv.y-.33) < .005 || abs(uv.y-.67) < .005) {
            gl_FragColor = vec4(1, 1, 1, 1);
        }
    }

`;

export const side_bar_VSText = `
   
precision mediump float;
attribute vec4 aVertPos;
attribute vec2 a_texcoord;

varying vec2 v_texcoord;

void main() {
    gl_Position = aVertPos;
    // vec2 tester = a_texcoord;
    // v_texcoord = vec2(0.5, 0.5);
    v_texcoord = a_texcoord;
}
`;

export const side_bar_FSText = `
precision mediump float;
uniform sampler2D u_texture;
varying vec2 v_texcoord;

    void main () {
    // gl_FragColor = vec4(1, 0, 0, 1);
    gl_FragColor = texture2D(u_texture, v_texcoord);
    }
`;