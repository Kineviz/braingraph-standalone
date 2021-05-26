import * as THREE from 'three'

const noop = (msg) => () => console.log(msg);
let noopGraph = {
  addNodes: noop('addNodes'),
  clear: noop('clear'),
}
let noopApi = {
  graph: {
    setCategoryColor: noop('setCategoryColor'),
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

function getApi() {
  return (window._app) ? window._app.controller.API : noopApi;
}

function getGraph() {
  return (window._app) ? window._app.controller.graph : noopGraph;
}

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
