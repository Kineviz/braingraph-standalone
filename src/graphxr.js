import * as THREE from 'three'

const noop = (msg) => () => console.log(msg);
let noopGraph = {
  addNodes: noop('controller.graph.addNodes'),
  clear: noop('controller.graph.clear'),
}
let noopApi = {
  graph: {
    setCategoryColor: noop('API.graph.setCategoryColor'),
  },
}
let noopDrawing = {
  scene: {
    add: noop('scene.add')
  },
}

class MockNode {
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
};

function isGraphXrLoaded() {
  return !!window._app;
}

function getApi() {
  return isGraphXrLoaded() ? window._app.controller.API : noopApi;
}

function getGraph() {
  return isGraphXrLoaded() ? window._app.controller.graph : noopGraph;
}

// GRAPH FUNCTIONS

export function clearGraph() {
  return getGraph().clear();
}

export function makeNode(id) {
  return (window._GXR) ? new window._GXR.Node(id) : new MockNode(id) 
}

export function addNodes(nodes) {
  return getGraph().addNodes(nodes);
}

export function setCategoryColor(category, color) {
  return getApi().graph.setCategoryColor(category, color);
}

// 3d FUNCTIONS

function getDrawing() {
  return isGraphXrLoaded() ? window._app.controller.drawing : noopDrawing;
}

export function getScene() {
  return getDrawing().cloudScene
}