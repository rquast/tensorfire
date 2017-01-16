import getTensorProgram from './program.js'
import assembleFragmentShader from './frag.js'
import { Tensor, OutputTensor, InPlaceTensor } from '../tensor/index.js'
import { checkFramebufferError } from './check.js'
import TNSL from './tnsl.js'


export function Compile(shaderGen, output, uniforms = {}){
    if(!(output instanceof OutputTensor)) 
        throw new Error("First argument must be an instance of OutputTensor");
    
    if(typeof shaderGen === 'string') shaderGen = TNSL(shaderGen);
    
    var gl = output.gl;
    return getTensorProgram(gl, assembleFragmentShader(shaderGen, output, uniforms));
}

export function Run(shaderGen, output, uniforms = {}){
    var tp = Compile(shaderGen, output, uniforms);

    var gl = output.gl;
    gl.useProgram(tp.program);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    var setUniform = tp.setUniform,
        texIndex = 0,
        mustSwap = false;
        
    for(let name in uniforms){
        if(name.startsWith('_')) continue;
        
        if((name + '_tex') in tp.uniformTypes){
            let tensor = uniforms[name];
            if(tensor === output) mustSwap = true;

            for(let uniform in tensor._info){
                setUniform(name + '_' + uniform, tensor._info[uniform])
            }

            gl.activeTexture(gl['TEXTURE' + texIndex]);
            gl.bindTexture(gl.TEXTURE_2D, tensor.tex);
            setUniform(name + '_tex', texIndex);

            texIndex++
        }else if(name in tp.uniformTypes){
            setUniform(name, uniforms[name])
        }else{
            throw new Error("Unknown uniform " + name);
        }
    }

    // Ordinarily we can't write to the same texture that we're using as
    // an input, as this could lead to all sorts of terrible race conditions,
    // undefined behavior, and invalid state. InPlaceTensors actually consist
    // of a pair of textures which are swapped for these in-place operations. 
    if(mustSwap) output.swap();

    // setUniform('_outputShape', output.shape)
    // setUniform('_outputCols', output.cols)

    for(let uniform in output._info){
        setUniform('out_' + uniform, output._info[uniform])
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, output.fbo);
    gl.viewport(0, 0, output._info.texSize[0], output._info.texSize[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // draw to framebuffer

    checkFramebufferError(gl);
    
    return output;
}