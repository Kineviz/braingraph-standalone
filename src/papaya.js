import * as THREE from "three";
import $ from "jquery";
import * as GraphXR from "./graphxr";
import * as marchingCubes from "./marching-cubes";
import pako from 'pako'

export const MAGIC_WAND = "magicWand";
export const PAINT_BRUSH = "paintBrush";

export const lesionTypes = {
  deepWhite: {value: 2, label: 'Deep White'},
  juxtacortical: {value: -1, label: 'Juxtacortical'},
  periventricular: {value: 6, label: 'Periventricular'},
  infratentorial: {value: 19, label: 'Infratentorial'},
}

export const DEFAULT_LESION_TYPE = lesionTypes.deepWhite.value;
export const NEW_SELECTION_VALUE = 5

const colors = (function () {
  let selected = new THREE.Color(0xff00ff);
  let background = new THREE.Color(0xffff00);
  let lesion = new THREE.Color(0xf54242);
  return {
    selected,
    background,
    lesion,
  };
})();

let screenVolumes,
  volumes,
  dimensions,
  selectionMesh,
  lesionMesh,
  maxBfsSteps = 5000,
  globalMax = 100000,
  currentSelection = {},
  paintBrushSelection = {},
  lesionNodes = {},
  radius = 0;

export function isLoaded() {
  return $("#papayaContainer0").length > 0;
}

export function scalePosition(position) {
  const dimensions = getDimensions();
  const { x, y, z } = position;
  const scale = 32;
  const xPos = (x - dimensions.x / 2) / scale; // 256 - 256/2 = 128, 0 - 256/2 = -128
  const yPos = (y - dimensions.y / 2) / scale;
  const zPos = (z - dimensions.z / 2) / scale;
  return new THREE.Vector3(xPos, yPos, zPos);
}

export function getDimensions() {
  const container = window.papayaContainers[0];
  const viewer = container.viewer;
  const x = viewer.axialSlice.xDim;
  const y = viewer.axialSlice.yDim;
  const z = viewer.coronalSlice.yDim;
  return { x, y, z };
}

export function getCurrentCoord() {
  return window.papayaContainers[0].viewer.currentCoord;
}

export async function loadPapaya(volumeUrls) {
  console.log("loadPapaya");

  return new Promise((resolve, reject) => {
    window.params = {
      images: [
        {
          url: volumeUrls.t1,
          params: { lut: "Grayscale" },
        },
        {
          url: volumeUrls.flair,
          params: { lut: "Grayscale" },
        },
        {
          url: volumeUrls.brain_seg,
          params: { alpha: 0 },
        },
        {
          url: volumeUrls.subtraction,
          params: { alpha: 0 },
        },
        {
          url: 'edited_lesion' in volumeUrls ? volumeUrls.edited_lesion : volumeUrls.lesions_original,
          params: { min: 0, max: 20, lut: "Spectrum" },
        },
        {
          url: volumeUrls.blank,
          params: { min: 0, max: 20, lut: "Spectrum" },
        },
      ],
    };
    window.params["worldSpace"] = false;
    window.params["allowScroll"] = false;
    window.params["loadingComplete"] = () => {
      console.log("Papaya is loaded");
      const container = window.papayaContainers[0];
      const viewer = container.viewer;
      const xDim = viewer.axialSlice.xDim;
      const yDim = viewer.axialSlice.yDim;
      const zDim = viewer.coronalSlice.yDim;

      dimensions = { xDim, yDim, zDim };

      volumes = {
        t1: viewer.screenVolumes[0].volume,
        flair: viewer.screenVolumes[1].volume,
        choroidPlexus: viewer.screenVolumes[2].volume,
        background: viewer.screenVolumes[3].volume,
        lesion: viewer.screenVolumes[4].volume,
        sandbox: viewer.screenVolumes[5].volume,
      };

      screenVolumes = {
        t1: viewer.screenVolumes[0],
        flair: viewer.screenVolumes[1],
        choroidPlexus: viewer.screenVolumes[2],
        background: viewer.screenVolumes[3],
        lesion: viewer.screenVolumes[4],
        sandbox: viewer.screenVolumes[5],
      };

      redraw();

      console.log("Papaya finished loading");

      resolve();
    };

    console.log("Loading Papaya");
    window.papayaContainers = [];
    $(`div[data-params='params']`).remove();
    if ($("#papaya").length == 0) $("#app-root").append(`<div id="papaya" class="papaya" data-params="params"></div>`);
    window.papaya.Container.startPapaya();
  });
}

function diposeMesh(mesh) {
  GraphXR.getScene().remove(mesh);
  mesh.geometry.dispose();
  mesh.material.dispose();
}

export function renderGraph() {
  GraphXR.clearGraph();

  // Add selection nodes and lesion nodes to graph
  const selectionNodes = Object.values({
    ...currentSelection,
    ...paintBrushSelection,
  });
  const lesionNodeValues = Object.values(lesionNodes);
  GraphXR.addNodes(selectionNodes);
  GraphXR.addNodes(lesionNodeValues);

  // Add some light
  // GraphXR.getScene().add(new THREE.AmbientLight(0x404040))
  const light = new THREE.DirectionalLight(0x404040);
  GraphXR.getScene().add(light);
  // DEBUG WITH A BOX

  // Compute surface of selection nodes using Marching Cubes
  if (selectionNodes?.length > 0) {
    if (selectionMesh) diposeMesh(selectionMesh);
    selectionMesh = marchingCubes.computeMesh(selectionNodes, scalePosition);
    GraphXR.getScene().add(selectionMesh);
  }

  // Compute surface of lesion nodes using Marching Cubes
  if (lesionNodes?.length > 0) {
    if (lesionMesh) diposeMesh(lesionMesh);
    lesionMesh = marchingCubes.computeMesh(lesionNodeValues, scalePosition);
    GraphXR.getScene().add(lesionMesh);
  }

  // Style the nodes
  Object.entries(colors).forEach(([category, color]) => {
    GraphXR.setCategoryColor(category, "#" + color.getHexString());
  });
}

export function getSelectedNodes() {
  return Object.values({
    ...currentSelection,
    ...paintBrushSelection,
  });
}

export function commitSelection(lesionType) {
  getSelectedNodes().forEach((node) => {
    // Map Selected Node to Lesion Node
    node.data.detail.type = "lesion";
    node.color = colors.lesion;
    lesionNodes[node.id] = node;

    // Color lesion voxel
    const { xid, yid, zid } = node.properties;
    setVoxel(volumes.lesion, xid, yid, zid, lesionType);
  });
  clear(volumes.sandbox);
  redraw();
}

export function removeSelection() {
  getSelectedNodes().forEach((node) => {
    const { xid, yid, zid } = node.properties;
    setVoxel(volumes.lesion, xid, yid, zid, 0);
    setVoxel(volumes.sandbox, xid, yid, zid, 0);
    const hash = hashXYZ(xid, yid, zid);
    delete currentSelection[hash];
    delete paintBrushSelection[hash];
    delete lesionNodes[hash];
  });
  redraw();
}

export function updateSelection(magicWandOptions) {
  const {localMin, seed} = magicWandOptions;
  let { component } = computeSelection({
    screenVolumes,
    volumes,
    seed,
    localMin,
    globalMax,
    dimensions,
  });
  currentSelection = component;
  return { selection: currentSelection };
}

export function fill(volume, value) {
  volume.imageData.data.fill(value);
}

export function clear(volume) {
  fill(volume, 0);
}

export function getVoxel(volume, x, y, z) {
  if (typeof volume === 'string') volume = volumes[volume]
  const container = window.papayaContainers[0];
  const viewer = container.viewer;
  const backgroundScreenVolume = viewer.screenVolumes[0];

  let interpolation = !backgroundScreenVolume.interpolation && container.preferences.smoothDisplay === "Yes";
  if (viewer.worldSpace) {
    interpolation |= volume.isWorldSpaceOnly();
    return volume.getVoxelAtCoordinate(
      (x - volume.header.origin.x) * volume.header.voxelDimensions.xSize,
      (volume.header.origin.y - y) * volume.header.voxelDimensions.ySize,
      (volume.header.origin.z - z) * volume.header.voxelDimensions.zSize,
      backgroundScreenVolume.currentTimepoint,
      !interpolation
    );
  } else {
    return volume.getVoxelAtMM(
      x * volume.header.voxelDimensions.xSize,
      y * volume.header.voxelDimensions.ySize,
      z * volume.header.voxelDimensions.zSize,
      backgroundScreenVolume.currentTimepoint,
      !interpolation
    );
  }
}

export function magicWand(magicWandOptions) {
  return updateSelection(magicWandOptions);
}

export function paintBrush(coord) {
  const volume = volumes.sandbox;
  const value = NEW_SELECTION_VALUE;
  for (let x = -radius; x <= radius; x++) {
    for (let y = -radius; y <= radius; y++) {
      for (let z = -radius; z <= radius; z++) {
        const targetX = coord.x + x;
        const targetY = coord.y + y;
        const targetZ = coord.z + z;
        console.log("painting", targetX, targetY, targetZ, value);
        getImageDataIndex(volume, targetX, targetY, targetZ).forEach((index) => {
          const node = makeNode(targetX, targetY, targetZ, "selected");
          paintBrushSelection[node.id] = node;
          volume.imageData.data[index] = value;
        });
      }
    }
  }
}

export function setVoxel(volume, x, y, z, value) {
  getImageDataIndex(volume, x, y, z).forEach((index) => {
    volume.imageData.data[index] = value;
  });
}

export function getImageDataIndex(volume, x, y, z) {
  let container = window.papayaContainers[0];
  let viewer = container.viewer;
  let voxelValue = volume.transform.voxelValue;
  let interpolation = !container.viewer.screenVolumes[0].interpolation && container.preferences.smoothDisplay === "Yes";
  if (viewer.worldSpace) {
    x = (x - volume.header.origin.x) * volume.header.voxelDimensions.xSize;
    y = (volume.header.origin.y - y) * volume.header.voxelDimensions.ySize;
    z = (volume.header.origin.z - z) * volume.header.voxelDimensions.zSize;
    let worldMat = volume.transform.worldMat;
    let xInt = Math.floor(x * worldMat[0][0] + y * worldMat[0][1] + z * worldMat[0][2] + worldMat[0][3]);
    let yInt = Math.floor(x * worldMat[1][0] + y * worldMat[1][1] + z * worldMat[1][2] + worldMat[1][3]);
    let zInt = Math.floor(x * worldMat[2][0] + y * worldMat[2][1] + z * worldMat[2][2] + worldMat[2][3]);
    let indices = [];
    for (let ctrX = 0; ctrX < 2; ctrX += 1) {
      for (let ctrY = 0; ctrY < 2; ctrY += 1) {
        indices.push(voxelValue.orientation.convertIndexToOffsetNative(xInt + ctrX, yInt + ctrY, zInt));
      }
    }
    return indices;
  } else {
    x = x * volume.header.voxelDimensions.xSize;
    y = y * volume.header.voxelDimensions.ySize;
    z = z * volume.header.voxelDimensions.zSize;
    let mat = volume.transform.mmMat;
    let xInt = Math.floor(x * mat[0][0] + y * mat[0][1] + z * mat[0][2] + mat[0][3]);
    let yInt = Math.floor(x * mat[1][0] + y * mat[1][1] + z * mat[1][2] + mat[1][3]);
    let zInt = Math.floor(x * mat[2][0] + y * mat[2][1] + z * mat[2][2] + mat[2][3]);
    return [voxelValue.orientation.convertIndexToOffsetNative(xInt, yInt, zInt)];
  }
}

export function getValueInBackground(coord) {
  let container = window.papayaContainers[0];
  let viewer = container.viewer;
  let screenVolume = container.viewer.screenVolumes[3];
  let volume = screenVolume.volume;
  let interpolation = !screenVolume.interpolation && container.preferences.smoothDisplay === "Yes";
  const { x, y, z } = coord;
  if (viewer.worldSpace) {
    interpolation |= volume.isWorldSpaceOnly();
    return volume.getVoxelAtCoordinate(
      (x - volume.header.origin.x) * volume.header.voxelDimensions.xSize,
      (volume.header.origin.y - y) * volume.header.voxelDimensions.ySize,
      (volume.header.origin.z - z) * volume.header.voxelDimensions.zSize,
      screenVolume.currentTimepoint,
      !interpolation
    );
  } else {
    return screenVolume.volume.getVoxelAtMM(
      x * volume.header.voxelDimensions.xSize,
      y * volume.header.voxelDimensions.ySize,
      z * volume.header.voxelDimensions.zSize,
      screenVolume.currentTimepoint,
      !interpolation
    );
  }
}

export function redraw() {
  window.papayaContainers[0].viewer.drawViewer(true, false);
  renderGraph();
}

export function getFile(volumeId) {
  const volume = volumes[volumeId];
  const header = volume.header.fileFormat.nifti;
  const imageData = volume.imageData.data;
  const combined = combineNiftiParts(header, imageData);
  const compressed = pako.gzip(combined)
  const blob = new Blob([compressed], { type: "application/octet-stream", });
  return new File([blob], "edited_lesion.nii.gz", {type: blob.type})
}

export function combineNiftiParts(header, imageData) {
  var byteSize = imageData.byteLength + header.vox_offset;
  var buffer = new ArrayBuffer(byteSize);

  var viewOfHeader = new Uint8Array(buffer);
  viewOfHeader.set(header.rawHeaderData);

  let viewOfImageData;
  console.log("Creating view of " + imageData.constructor.name);
  switch (imageData.constructor.name) {
    case "Int8Array":
      viewOfImageData = new Int8Array(buffer, header.vox_offset);
      break;
    case "UInt8Array":
      viewOfImageData = new UInt8Array(buffer, header.vox_offset);
      break;
    case "UInt8ClampedArray":
      viewOfImageData = new UInt8ClampedArray(buffer, header.vox_offset);
      break;
    case "Int16Array":
      viewOfImageData = new Int16Array(buffer, header.vox_offset);
      break;
    case "UInt16Array":
      viewOfImageData = new UInt16Array(buffer, header.vox_offset);
      break;
    case "Int32Array":
      viewOfImageData = new Int32Array(buffer, header.vox_offset);
      break;
    case "UInt32Array":
      viewOfImageData = new UInt32Array(buffer, header.vox_offset);
      break;
    case "Float32Array":
      viewOfImageData = new Float32Array(buffer, header.vox_offset);
      break;
    case "Float64Array":
      viewOfImageData = new Float64Array(buffer, header.vox_offset);
      break;
    case "BigInt64Array":
      viewOfImageData = new BigInt64Array(buffer, header.vox_offset);
      break;
    case "BigUInt64Array":
      viewOfImageData = new BigUInt64Array(buffer, header.vox_offset);
      break;
  }
  viewOfImageData.set(imageData);

  return buffer;
}

export function downloadNiiGz(volumeId) {
  const volume = volumes[volumeId];
  const header = volume.header.fileFormat.nifti;
  const imageData = volume.imageData.data;
  window.nifti.downloadNiiGz(header, imageData);
}

class Node {
  constructor(id) {
    this.id = id;
    this.data = {
      detail: {},
    };
    this.position = new THREE.Vector3();
  }

  get properties() {
    return this.data.detail.data;
  }
}

export function drawSelection(nodes, value) {
  const volume = volumes.sandbox;
  if (nodes && nodes.length > 0) {
    console.log(`highlighting ${nodes.length} component nodes with value ${value}`);
    clear(volume);
    nodes.forEach((node) => {
      const { xid, yid, zid } = node.properties;
      setVoxel(volume, xid, yid, zid, value);
    });
    redraw();
  }
}

function hashXYZ(x, y, z) {
  return `${x},${y},${z}`;
}

function makeNode(x, y, z, category) {
  const id = hashXYZ(x, y, z);
  const choroidPlexus = volumes ? getVoxel(volumes.choroidPlexus, x, y, z) : 0;
  const lesion = volumes ? getVoxel(volumes.lesion, x, y, z) : 0;
  const background = volumes ? getVoxel(volumes.background, x, y, z) : 0;
  const node = GraphXR.makeNode(id);
  node.data.detail = {
    type: category,
    data: {
      uid: id,
      uid_next: hashXYZ(x + 1, y + 1, z + 1),
      xid: x,
      yid: y,
      zid: z,
      lesion,
      background,
      choroidPlexus,
    },
  };
  node.position = scalePosition({ x, y, z });
  return node;
}

function getUnvisitedNeighbors(nodes, node, category) {
  let { xid, yid, zid } = node.properties;
  let neighbors = [];
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (x == 0 && y == 0 && z == 0) continue;
        let newx = xid + x,
          newy = yid + y,
          newz = zid + z;
        let id = hashXYZ(newx, newy, newz);
        let neighbor = nodes[id]; // 'id' is visited if it is in nodes
        if (!neighbor) {
          neighbor = makeNode(newx, newy, newz, category);
          neighbor.properties.visited = false;
          nodes[id] = neighbor;
          neighbors.push(neighbor);
        }
      }
    }
  }
  return neighbors;
}

function isUncommitted(value) {
  return value === 0
}

function inChoroidPlexus(value) {
  return value === 8
}

function isBetween(value, min, max) {
  return value >= min && value <= max
}

function bfs(nodes, node, testNeighborFn, category, maxBfsSteps, volumes, dimensions) {
  let queue = [node];
  let component = { [node.id]: node };
  let step = 1;
  while (queue.length > 0) {
    let n = queue.shift();
    n.properties.visited = true;
    getUnvisitedNeighbors(nodes, n, category, volumes, dimensions).forEach((neighbor) => {
      if (testNeighborFn(neighbor)) {
        component[neighbor.id] = neighbor;
        queue.push(neighbor);
      }
    });
    step++;
    if (step == maxBfsSteps) break;
  }
  return { queue, component };
}

export function computeSelection({ volumes, seed: { x, y, z }, localMin, globalMax, dimensions }) {
  console.log("computeSelection()", x, y, z, localMin);
  let id = hashXYZ(x, y, z);
  const seedNode = makeNode(x, y, z, "selected");
  const nodes = { [id]: seedNode };
  const value = getVoxel(volumes.lesion, x, y, z)
  if (value > 0) {
    console.log("Computing existing component");
    return bfs(
      nodes,
      seedNode,
      (neighbor) => neighbor.properties.lesion === value,
      "selected",
      1e12,
      volumes,
      dimensions
    );
  } else {
    console.log("Computing new component");
    return bfs(
      nodes,
      seedNode,
      (neighbor) => (!inChoroidPlexus(neighbor.properties.choroidPlexus)
        && isBetween(neighbor.properties.background, localMin, globalMax)
        && isUncommitted(neighbor.properties.lesion)),
      "selected",
      maxBfsSteps,
      volumes,
      dimensions
    );
  }
}
