import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Oval } from "svg-loaders-react";

import * as papaya from "./papaya.js";
import * as cognito from "./cognito.js";
import { setJwt, getJwt } from "./features/s3-url-service/s3UrlServiceSlice";

import "./papaya.css";

export default function Papaya() {
  const jwt = useSelector(getJwt);
  const dispatch = useDispatch();

  const [studyId, setStudyId] = useState("");
  const [studyUrls, setStudyUrls] = useState(undefined);
  const [magicWandOptions, setMagicWandOptions] = useState({seed: undefined, localMin: undefined});
  const [loading, setLoading] = useState({ status: false, text: "" });
  const [tool, setTool] = useState(papaya.MAGIC_WAND);

  useEffect(async () => {
    if (!jwt) {
      const jwt = await cognito.login("bgoosman", "px$p83sjTbA9[}");
      dispatch(setJwt(jwt));
    }
  }, []);

  useEffect(async () => {
    if (jwt && studyId) {
      try {
        setLoading({ status: true, text: "Fetching NIFTI URLs..." });
        const studyUrls = await cognito.getObjectUrls(jwt, studyId);
        setStudyUrls(studyUrls);
        setLoading({ status: false, text: undefined });
      } catch (e) {
        setLoading({ status: false });
        dispatch(setJwt(undefined));
      }
    }
  }, [studyId]);

  const registerPapayaEventHandlers = () => {
    console.log(`debug: registerPapayaEventHandlers tool=${tool}`)
    const $papayaCanvas = $('div[id^="papayaViewer"] canvas');
    $papayaCanvas.off('mousedown mouseup mouseover')
    $papayaCanvas.on("mousedown", function (e) {
      if (e.shiftKey) {
        const handler = () => {
          console.log(`debug: handle shiftKey tool=${tool}`)
          if (tool === papaya.MAGIC_WAND) {
            setMagicWandOptions({
              seed: papaya.getCurrentCoord(),
              localMin: papaya.getValueInBackground(papaya.getCurrentCoord()),
            });
          } else if (tool === papaya.PAINT_BRUSH) {
            papaya.paintBrush(papaya.getCurrentCoord(), 0);
          }
          papaya.redraw();
        };
        $papayaCanvas.on("mouseup", function (e) {
          $papayaCanvas.off("mousemove", handler);
        });
        $papayaCanvas.on("mousemove", handler);
        handler();
      }
    });
  };

  useEffect(async () => {
    if (papaya.isLoaded()) {
      registerPapayaEventHandlers();
    }
  }, [tool]);

  useEffect(async () => {
    if (studyUrls) {
      setLoading({ status: true, text: "Loading NIFTIs into Papaya..." });
      await papaya.loadPapaya(studyUrls);
      registerPapayaEventHandlers();
      setLoading({ status: false, text: undefined });
    }
  }, [studyUrls]);

  useEffect(async () => {
    if (papaya.isLoaded()) {
      setLoading({ status: true, text: "Computing selection..." });
      console.log(`debug: magicWandOptions`, magicWandOptions)
      const {localMin, seed} = magicWandOptions
      papaya.magicWand(localMin, seed);
      setLoading({ status: false, text: undefined });
    }
  }, [magicWandOptions]);

  return (
    <>
      <form className="space-x-4 p-4 flex">
        <select
          className="rounded-lg border-2 p-2 pr-4 pl-4"
          name="studyId"
          onChange={(e) => setStudyId(e.target.value)}
        >
          <option>Select a study...</option>
          {cognito.studyIds.map((studyId) => (
            <option key={studyId}>{studyId}</option>
          ))}
        </select>
        <input
          className="rounded-lg border-2 p-2 pr-4 pl-4"
          type="number"
          id="localMin"
          name="localMin"
          min="-100"
          max="100"
          step="0.01"
          onChange={(e) => {
            e.preventDefault();
            setMagicWandOptions({...magicWandOptions, localMin: e.target.value});
          }}
          value={magicWandOptions.localMin}
        ></input>
        <button
          className={`rounded-lg border-2 p-2 pr-4 pl-4 ${
            tool === papaya.MAGIC_WAND ? "text-white bg-gradient-to-r from-green-400 to-blue-500" : ""
          }`}
          onClick={(e) => {
            e.preventDefault();
            setTool(papaya.MAGIC_WAND);
          }}
        >
          Magic Wand
        </button>
        <button
          className={`rounded-lg border-2 p-2 pr-4 pl-4 ${
            tool === papaya.PAINT_BRUSH ? "text-white bg-gradient-to-r from-green-400 to-blue-500" : ""
          }`}
          onClick={(e) => {
            e.preventDefault();
            setTool(papaya.PAINT_BRUSH);
          }}
        >
          Paint
        </button>
        <button
          className="rounded-lg border-2 p-2 pr-4 pl-4"
          onClick={(e) => {
            e.preventDefault();
            papaya.commitSelection();
            papaya.renderGraph();
          }}
        >
          Commit
        </button>
        <button
          className="rounded-lg border-2 p-2 pr-4 pl-4"
          onClick={(e) => {
            e.preventDefault();
            papaya.removeSelection();
            papaya.renderGraph();
          }}
        >
          Clear
        </button>
        <button
          className="rounded-lg border-2 p-2 pr-4 pl-4"
          onClick={(e) => {
            e.preventDefault();
            papaya.downloadNiiGz("lesion");
          }}
        >
          Save
        </button>
        {loading.status && (
          <>
            <Oval stroke="#98ff98" />
            {loading?.text && (
              <p className="leading-loose">
                <span className="align-middle">{loading.text}</span>
              </p>
            )}
          </>
        )}
      </form>
      {studyUrls && (
        <div style={{ width: 1024 }}>
          <div id="papaya" className="papaya" data-params="params"></div>
        </div>
      )}
    </>
  );
}
