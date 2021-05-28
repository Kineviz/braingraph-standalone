import * as THREE from "three";
import * as GraphXR from "./graphxr";
import * as MarchingCubesLookup from "./marching-cubes-lookup";
import * as papaya from "./papaya";

export function computeMesh(nodes, scalePosition) {
  const scene = GraphXR.getScene();
  const isoLevel = 0;
  let vertexIndex = 0;
  const vlist = new Array(12);
  const geometry = new THREE.Geometry();
  const dimensions = papaya.getDimensions();

  const hashPosition = (position) => {
    const { x, y, z } = position;
    return `${x},${y},${z}`;
  };

  const isoValueOf = (node) => {
    return node ? 1 : 0;
  };

  const isValueInIsoSurface = (value) => {
    return value > 0;
  };

  const nodeSet = {};
  let minX = 1e12,
    minY = 1e12,
    minZ = 1e12,
    maxX = 0,
    maxY = 0,
    maxZ = 0;
  nodes.forEach((node) => {
    const isoValue = isoValueOf(node);
    const inIsoSurface = isValueInIsoSurface(isoValue);
    const properties = node.properties;
    properties.isoValue = isoValue;
    properties.inIsoSurface = inIsoSurface;
    const { xid, yid, zid } = node.properties;
    nodeSet[hashPosition({ x: xid, y: yid, z: zid })] = node;
    minX = Math.min(xid, minX);
    minY = Math.min(yid, minY);
    minZ = Math.min(zid, minZ);
    maxX = Math.max(xid, maxX);
    maxY = Math.max(yid, maxY);
    maxZ = Math.max(zid, maxZ);
  });

  for (var z = minZ; z < maxZ - 1; z++) {
    for (var y = minY; y < maxY - 1; y++) {
      for (var x = minX; x < maxX - 1; x++) {
        const points = {
          p: new THREE.Vector3(x, y, z),
          px: new THREE.Vector3(x + 1, y, z),
          py: new THREE.Vector3(x, y + 1, z),
          pxy: new THREE.Vector3(x + 1, y + 1, z),
          pz: new THREE.Vector3(x, y, z + 1),
          pxz: new THREE.Vector3(x + 1, y, z + 1),
          pyz: new THREE.Vector3(x, y + 1, z + 1),
          pxyz: new THREE.Vector3(x + 1, y + 1, z + 1),
        };

        const nodes = Object.fromEntries(
          Object.entries(points).map(([pointKey, point]) => {
            const node = nodeSet[hashPosition(point)];
            return [pointKey, node];
          })
        );

        const values = Object.fromEntries(
          Object.entries(nodes).map(([pointKey, node]) => {
            const value = node ? node.properties.isoValue : 0;
            return [pointKey, value];
          })
        );

        const value0 = values.p,
          value1 = values.px,
          value2 = values.py,
          value3 = values.pxy,
          value4 = values.pz,
          value5 = values.pxz,
          value6 = values.pyz,
          value7 = values.pxyz;

        // place a "1" in bit positions corresponding to vertices whose
        //   isovalue is less than given constant.

        var cubeindex = 0;
        if (value0 > isoLevel) cubeindex |= 1;
        if (value1 > isoLevel) cubeindex |= 2;
        if (value2 > isoLevel) cubeindex |= 8;
        if (value3 > isoLevel) cubeindex |= 4;
        if (value4 > isoLevel) cubeindex |= 16;
        if (value5 > isoLevel) cubeindex |= 32;
        if (value6 > isoLevel) cubeindex |= 128;
        if (value7 > isoLevel) cubeindex |= 64;

        // bits = 12 bit number, indicates which edges are crossed by the isosurface
        var bits = MarchingCubesLookup.edgeTable[cubeindex];

        // if none are crossed, proceed to next iteration
        if (bits === 0) continue;

        // check which edges are crossed, and estimate the point location
        //    using a weighted average of scalar values at edge endpoints.
        // store the vertex in an array for use later.
        var mu = 0.5;

        // bottom of the cube
        if (bits & 1) {
          mu = (isoLevel - value0) / (value1 - value0);
          vlist[0] = points.p.clone().lerp(points.px, mu);
        }
        if (bits & 2) {
          mu = (isoLevel - value1) / (value3 - value1);
          vlist[1] = points.px.clone().lerp(points.pxy, mu);
        }
        if (bits & 4) {
          mu = (isoLevel - value2) / (value3 - value2);
          vlist[2] = points.py.clone().lerp(points.pxy, mu);
        }
        if (bits & 8) {
          mu = (isoLevel - value0) / (value2 - value0);
          vlist[3] = points.p.clone().lerp(points.py, mu);
        }
        // top of the cube
        if (bits & 16) {
          mu = (isoLevel - value4) / (value5 - value4);
          vlist[4] = points.pz.clone().lerp(points.pxz, mu);
        }
        if (bits & 32) {
          mu = (isoLevel - value5) / (value7 - value5);
          vlist[5] = points.pxz.clone().lerp(points.pxyz, mu);
        }
        if (bits & 64) {
          mu = (isoLevel - value6) / (value7 - value6);
          vlist[6] = points.pyz.clone().lerp(points.pxyz, mu);
        }
        if (bits & 128) {
          mu = (isoLevel - value4) / (value6 - value4);
          vlist[7] = points.pz.clone().lerp(points.pyz, mu);
        }
        // vertical lines of the cube
        if (bits & 256) {
          mu = (isoLevel - value0) / (value4 - value0);
          vlist[8] = points.p.clone().lerp(points.pz, mu);
        }
        if (bits & 512) {
          mu = (isoLevel - value1) / (value5 - value1);
          vlist[9] = points.px.clone().lerp(points.pxz, mu);
        }
        if (bits & 1024) {
          mu = (isoLevel - value3) / (value7 - value3);
          vlist[10] = points.pxy.clone().lerp(points.pxyz, mu);
        }
        if (bits & 2048) {
          mu = (isoLevel - value2) / (value6 - value2);
          vlist[11] = points.py.clone().lerp(points.pyz, mu);
        }

        // construct triangles -- get correct vertices from triTable.
        var i = 0;
        cubeindex <<= 4; // multiply by 16...
        // "Re-purpose cubeindex into an offset into triTable."
        //  since each row really isn't a row.

        // the while loop should run at most 5 times,
        //   since the 16th entry in each row is a -1.
        while (MarchingCubesLookup.triTable[cubeindex + i] != -1) {
          var index1 = MarchingCubesLookup.triTable[cubeindex + i];
          var index2 = MarchingCubesLookup.triTable[cubeindex + i + 1];
          var index3 = MarchingCubesLookup.triTable[cubeindex + i + 2];

          [index1, index2, index3].forEach((index) => {
            geometry.vertices.push(scalePosition(vlist[index].clone()));
          });
          var face = new THREE.Face3(vertexIndex, vertexIndex + 1, vertexIndex + 2);
          geometry.faces.push(face);

          geometry.faceVertexUvs[0].push([new THREE.Vector2(0, 0), new THREE.Vector2(0, 1), new THREE.Vector2(1, 1)]);

          vertexIndex += 3;
          i += 3;
        }
      }
    }
  }

  geometry.computeVertexNormals();
  geometry.computeFaceNormals();

  let colorMaterial = new THREE.MeshNormalMaterial();
  // let colorMaterial = new THREE.MeshPhongMaterial( { ambient: 0x050505, color: 0x0033ff, specular: 0x555555, shininess: 30 } )
  return new THREE.Mesh(geometry, colorMaterial);
}
