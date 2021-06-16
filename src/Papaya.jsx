import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Oval } from "svg-loaders-react";
import _ from "lodash";

import * as papaya from "./papaya.js";
import * as cognito from "./cognito.js";
import { setJwt, getJwt } from "./features/s3-url-service/s3UrlServiceSlice";

import "./papaya.css";

const STEP = 0.1;

const debouncedMagicWand = _.debounce((magicWandOptions, setLoading) => {
  if (papaya.isLoaded()) {
    setLoading({ status: true, text: "Computing selection..." });
    console.log(`debug: magicWandOptions`, magicWandOptions);
    const { localMin, seed } = magicWandOptions;
    papaya.magicWand(localMin, seed);
    setLoading({ status: false, text: undefined });
  }
}, 300);

export default function Papaya() {
  const [studyUrls, setStudyUrls] = useState(undefined);
  const [magicWandOptions, setMagicWandOptions] = useState({ seed: undefined, localMin: undefined });

  const DECREMENT_THRESHOLD = "DECREMENT_THRESHOLD";
  const INCREMENT_THRESHOLD = "INCREMENT_THRESHOLD";
  const [thresholdAction, setThresholdAction] = useState({ type: undefined });

  const [uploadAction, setUploadAction] = useState({ volumeId: undefined });

  const [extension, setExtension] = useState(undefined);
  const [loading, setLoading] = useState({ status: false, text: "" });
  const [tool, setTool] = useState(papaya.MAGIC_WAND);

  const registerMouseWheel = ($papayaCanvas) => {
    $papayaCanvas.off("mousewheel DOMMouseScroll");
    $papayaCanvas.on("mousewheel DOMMouseScroll", function (e) {
      if (e.shiftKey) {
        if (e.originalEvent.wheelDelta > 0 || e.originalEvent.detail < 0) {
          // scroll up
          setThresholdAction({ type: INCREMENT_THRESHOLD });
        } else {
          // scroll down
          setThresholdAction({ type: DECREMENT_THRESHOLD });
        }
      }
    });
  };

  const registerPapayaEventHandlers = () => {
    console.log(`debug: registerPapayaEventHandlers tool=${tool}`);
    const $papayaCanvas = $('div[id^="papayaViewer"] canvas');
    registerMouseWheel($papayaCanvas);
    $papayaCanvas.off("mousedown mouseup mouseover");
    $papayaCanvas.on("mousedown", function (e) {
      if (e.shiftKey) {
        const handler = () => {
          console.log(`debug: handle shiftKey tool=${tool}`);
          if (tool === papaya.MAGIC_WAND) {
            const seed = papaya.getCurrentCoord();
            const localMin = papaya.getValueInBackground(papaya.getCurrentCoord());
            const options = { seed, localMin };
            setMagicWandOptions(options);
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

  useEffect(() => {
    const { type } = thresholdAction;
    if (type) {
      let { localMin } = magicWandOptions;
      localMin += type === DECREMENT_THRESHOLD ? -STEP : STEP;
      console.log(`debug: thresholdAction localMin=${localMin}`);
      setMagicWandOptions({ ...magicWandOptions, localMin });
      setThresholdAction({ type: undefined });
    }
  }, [thresholdAction]);

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
    debouncedMagicWand(magicWandOptions, setLoading);
  }, [magicWandOptions]);

  useEffect(async () => {
    if (window.Flywheel) {
      setLoading({ status: true, text: "Initializing BrainGraph as a Flywheel extension..." });
      window.Flywheel.initExtension({ scope: 'ReadWrite', validateOrigin: origin => origin.endsWith('flywheel.io') })
        .then((extension) => {
          setExtension(extension);
          setLoading({ status: false, text: undefined });
        })
        .catch((e) => {
          console.log("initExtension failed", e);
        });
    }
  }, []);

  useEffect(async () => {
    if (extension !== undefined) {
      setLoading({ status: true, text: "Loading NIFTIs from Flywheel..." });
      console.log(extension);
      const { container } = extension;
      const { files } = container;
      console.log(files);
      const blobs = files.map((file) => extension.getFileBlob(container, file));
      Promise.all(blobs).then((blobs) => {
        const studyUrls = Object.fromEntries(
          blobs.map((blob, i) => {
            const fileName = files[i].name;
            return [fileName.substr(0, fileName.indexOf(".")), URL.createObjectURL(blob)];
          })
        );
        setLoading({ status: false, text: undefined });
        setStudyUrls(studyUrls);
      });
    }
  }, [extension]);

  useEffect(() => {
    if (window.Flywheel && extension && uploadAction.volumeId) {
      setLoading({ status: true, text: "Uploading data to Flywheel..." });
      const { container } = extension;
      const file = papaya.getFile(uploadAction.volumeId)
      console.log(file);
      extension.uploadFile(container, file).toPromise().then(() => {
        setLoading({ status: false, text: undefined })
      })
      setUploadAction({volumeId: undefined})
    }
  }, [uploadAction]);

  return (
    <>
      <form className="-m-2 p-4 flex-wrap">
        <input
          type="range"
          className="m-2"
          id="localMin"
          name="localMin"
          min="-5"
          max="5"
          step={STEP}
          onChange={(e) => {
            e.preventDefault();
            setMagicWandOptions({ ...magicWandOptions, localMin: parseFloat(e.target.value) });
          }}
          value={magicWandOptions.localMin}
        />
        <input
          type="number"
          className="rounded-lg border-2 m-2 p-2 pr-4 pl-4"
          id="localMin"
          name="localMin"
          min="-5"
          max="5"
          step={STEP}
          onChange={(e) => {
            e.preventDefault();
            setMagicWandOptions({ ...magicWandOptions, localMin: parseFloat(e.target.value) });
          }}
          value={magicWandOptions.localMin}
        />
        <button
          className={`rounded-lg border-2 m-2 p-2 pr-4 pl-4 ${
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
          className={`rounded-lg border-2 m-2 p-2 pr-4 pl-4 ${
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
          className="rounded-lg border-2 m-2 p-2 pr-4 pl-4"
          onClick={(e) => {
            e.preventDefault();
            papaya.commitSelection();
            papaya.renderGraph();
          }}
        >
          Commit
        </button>
        <button
          className="rounded-lg border-2 m-2 p-2 pr-4 pl-4"
          onClick={(e) => {
            e.preventDefault();
            papaya.removeSelection();
            papaya.renderGraph();
          }}
        >
          Clear
        </button>
        <button
          className="rounded-lg border-2 m-2 p-2 pr-4 pl-4"
          onClick={(e) => {
            e.preventDefault();
            setUploadAction({ volumeId: "lesion" });
          }}
        >
          Save
        </button>
        {loading.status && (
          <div className="flex m-2">
            <Oval stroke="#98ff98" />
            {loading?.text && (
              <p className="ml-2 leading-loose">
                <span className="align-middle">{loading.text}</span>
              </p>
            )}
          </div>
        )}
      </form>
    </>
  );
}
