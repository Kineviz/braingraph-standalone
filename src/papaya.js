import * as THREE from "three";
import $ from "jquery";
import * as GraphXR from "./graphxr";
import * as marchingCubes from "./marching-cubes";

export const MAGIC_WAND = "magicWand";
export const PAINT_BRUSH = "paintBrush";
export const LESION_VALUE = 1;

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

  if (isLoaded()) return;

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
          url: volumeUrls.lesions_original,
          params: { min: 0, max: 15, lut: "Red Overlay" },
        },
        {
          url: volumeUrls.blank,
          params: { min: 4.99, max: 10.01, lut: "Green Overlay" },
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
        background: viewer.screenVolumes[3].volume,
        lesion: viewer.screenVolumes[4].volume,
        sandbox: viewer.screenVolumes[5].volume,
      };

      screenVolumes = {
        background: viewer.screenVolumes[3],
        lesion: viewer.screenVolumes[4],
        sandbox: viewer.screenVolumes[5],
      };

      redraw();

      console.log("Papaya finished loading");

      resolve();
    };

    console.log("Loading Papaya");
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
  const lesionNodeValues = Object.values(lesionNodes)
  GraphXR.addNodes(selectionNodes);
  GraphXR.addNodes(lesionNodeValues);

  // Add some light
  // GraphXR.getScene().add(new THREE.AmbientLight(0x404040))
  const light = new THREE.DirectionalLight( 0x404040 );
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

export function commitSelection() {
  getSelectedNodes().forEach((node) => {
    // Map Selected Node to Lesion Node
    node.data.detail.type = "lesion";
    node.color = colors.lesion;
    lesionNodes[node.id] = node;

    // Color lesion voxel
    const { xid, yid, zid } = node.properties;
    setVoxel(volumes.lesion, xid, yid, zid, LESION_VALUE);
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

export function updateSelection(localMin, seed) {
  let { component, queue, step } = computeSelection({
    screenVolumes,
    volumes,
    seed,
    localMin,
    globalMax,
    dimensions,
  });
  currentSelection = component;
  drawSelection(Object.values(component), volumes.sandbox, 5);
}

export function fill(volume, value) {
  volume.imageData.data.fill(value);
}

export function clear(volume) {
  fill(volume, 0);
}

export function getVoxel(volume, x, y, z) {
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

export function magicWand(localMin, seed) {
  updateSelection(localMin, seed);
}

export function paintBrush(coord) {
  const volume = volumes.sandbox;
  const value = 5;
  for (let x = -radius; x <= radius; x++) {
    for (let y = -radius; y <= radius; y++) {
      for (let z = -radius; z <= radius; z++) {
        const targetX = coord.x + x;
        const targetY = coord.y + y;
        const targetZ = coord.z + z;
        console.log("painting", targetX, targetY, targetZ, value);
        getImageDataIndex(volume, targetX, targetY, targetZ).forEach((index) => {
          const node = makeNode(targetX, targetY, targetZ, "selected", volumes, dimensions);
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

export function drawSelection(nodes, volume, value) {
  if (nodes && nodes.length > 0) {
    console.log(`highlighting ${nodes.length} component nodes`);
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

function makeNode(x, y, z, category, volumes, dimensions) {
  const id = hashXYZ(x, y, z);
  const lesion = getVoxel(volumes.lesion, x, y, z);
  const background = getVoxel(volumes.background, x, y, z);
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
    },
  };
  node.position = scalePosition({ x, y, z });
  return node;
}

function getUnvisitedNeighbors(nodes, node, category, volumes, dimensions) {
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
        let neighbor = nodes[id];
        if (!neighbor) {
          neighbor = makeNode(newx, newy, newz, category, volumes, dimensions);
          neighbor.properties.visited = false;
          nodes[id] = neighbor;
          neighbors.push(neighbor);
        }
      }
    }
  }
  return neighbors;
}

function bfs(nodes, node, min, max, volumeKey, category, maxBfsSteps, volumes, dimensions) {
  let queue = [node];
  let component = { [node.id]: node };
  let step = 1;
  while (queue.length > 0) {
    let n = queue.shift();
    n.properties.visited = true;
    getUnvisitedNeighbors(nodes, n, category, volumes, dimensions).forEach((neighbor) => {
      const val = neighbor.properties[volumeKey];
      if (val >= min && val < max) {
        neighbor.properties.selected = true;
        component[neighbor.id] = neighbor;
        queue.push(neighbor);
      }
    });
    step++;
    if (step == maxBfsSteps) break;
  }
  return { queue, component };
}

export function computeSelection({ screenVolumes, volumes, seed: { x, y, z }, localMin, globalMax, dimensions }) {
  console.log("computeSelection()", x, y, z, localMin);
  let id = hashXYZ(x, y, z);
  const seedNode = makeNode(x, y, z, "lesion", volumes, dimensions);
  if (getVoxel(volumes.lesion, x, y, z) > 0) {
    console.log("Computing existing component");
    const nodes = { [id]: seedNode };
    const range = screenVolumes.lesion.getRange();
    const { component, queue } = bfs(
      nodes,
      seedNode,
      LESION_VALUE,
      range[1],
      "lesion",
      "selected",
      1e12,
      volumes,
      dimensions
    );
    // drawSelection(Object.values(component), volumes.sandbox, 5);
    return { component, queue, step: 0 };
  } else {
    console.log("Computing new component");
    let step = 0;
    let derivative = 0;
    let lastComponent, lastQueue, derivativeDelta;
    let searchMin = localMin;
    while (true) {
      const nodes = { [id]: seedNode };
      const { component, queue } = bfs(
        nodes,
        seedNode,
        searchMin,
        globalMax,
        "background",
        "selected",
        maxBfsSteps,
        volumes,
        dimensions
      );
      if (lastComponent) {
        const lastCount = Object.keys(lastComponent).length;
        const currentCount = Object.keys(component).length;
        const derivativePrime = currentCount / lastCount;
        derivativeDelta = derivativePrime - derivative;
        derivative = derivativePrime;
      }
      lastComponent = component;
      lastQueue = queue;
      console.log({ derivative, derivativeDelta, component, lastComponent, searchMin });
      searchMin -= 0.01;
      // yield { component, queue, step };
      break;
      step++;
      if (searchMin <= 1) break;
      if (Math.abs(derivativeDelta) < 0.01) {
        console.log("derivativeDelta");
        break;
      }
      if (derivative == 1) break;
    }
    // drawSelection(Object.values(lastComponent), volumes.sandbox, 5);
    return { component: lastComponent, queue: lastQueue, step };
  }
}
