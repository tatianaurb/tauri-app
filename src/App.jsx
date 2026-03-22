import { useState, useEffect, useRef } from "react";
import {
  scan,
  Format,
  cancel,
  checkPermissions,
  requestPermissions,
  openAppSettings,
} from "@tauri-apps/plugin-barcode-scanner";
import { Viewer } from "photo-sphere-viewer";
import Lottie from "lottie-react";
import loaderAnimation from "./assets/loader.json";
import failedAnimation from "./assets/failed.json";
import "photo-sphere-viewer/dist/photo-sphere-viewer.css";
import "./App.css";

function App() {
  const [page, setPage] = useState("home"); 
  const [loading, setLoading] = useState(false);
  const [roomText, setRoomText] = useState("");
  const [roomImage, setRoomImage] = useState("");
  const [floorsData, setFloorsData] = useState({});
  const [currentRooms, setCurrentRooms] = useState({});
  const [selectedFloor, setSelectedFloor] = useState("");
  const [panoramaLoading, setPanoramaLoading] = useState(false);
  const [cameFromMap, setCameFromMap] = useState(false);
  const [roomsDropdownOpen, setRoomsDropdownOpen] = useState(false);
  const viewerRef = useRef(null);

  const FLOORS_JSON_URL =
    "https://raw.githubusercontent.com/tatianaurb/rooms-data/main/floors.json";

  useEffect(() => {
    const fetchFloors = async () => {
      try {
        const response = await fetch(FLOORS_JSON_URL);
        if (!response.ok) throw new Error("Nepodarilo sa načítať floors.json");
        const data = await response.json();
        setFloorsData(data);
      } catch (err) {
        console.error("Chyba pri načítaní floors.json:", err);
      }
    };

    fetchFloors();
  }, []);

  useEffect(() => {
    const fetchRoomsForFloor = async () => {
      if (!selectedFloor || !floorsData[selectedFloor]?.roomsFile) {
        setCurrentRooms({});
        return;
      }

      try {
        setCurrentRooms({});
        const response = await fetch(floorsData[selectedFloor].roomsFile);
        if (!response.ok) throw new Error("Nepodarilo sa načítať rooms JSON");
        const data = await response.json();
        setCurrentRooms(data);
      } catch (err) {
        console.error("Chyba pri načítaní miestností:", err);
        setCurrentRooms({});
      }
    };

    if (page === "floorDetail") {
      fetchRoomsForFloor();
    }
  }, [selectedFloor, floorsData, page]);

  useEffect(() => {
    if (page === "detail" && roomImage) {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }

      setPanoramaLoading(true);

      viewerRef.current = new Viewer({
        container: document.getElementById("panorama"),
        panorama: roomImage,
        mousewheel: true,
        touchmoveTwoFingers: false,
        navbar: false,
        loadingTxt: null,
        loadingImg: null,
      });

      viewerRef.current.once("ready", () => {
        setPanoramaLoading(false);
      });

      viewerRef.current.once("error", () => {
        setPanoramaLoading("error");
      });

      // Zachytí HttpError ktorý photo-sphere-viewer hádže ako unhandled promise rejection
      const handleUnhandledRejection = (event) => {
        if (
          event.reason?.name === "HttpError" ||
          event.reason?.message?.includes("404") ||
          event.reason?.message?.includes("fetch")
        ) {
          setPanoramaLoading("error");
          event.preventDefault();
        }
      };

      window.addEventListener("unhandledrejection", handleUnhandledRejection);

      return () => {
        window.removeEventListener("unhandledrejection", handleUnhandledRejection);
        if (viewerRef.current) {
          viewerRef.current.destroy();
          viewerRef.current = null;
        }
      };
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [page, roomImage]);

  const handleScan = async () => {
    setLoading(true);
    setRoomText("");
    setRoomImage("");
    setPage("scan");

    try {
      document.body.style.backgroundColor = "transparent";
      document.documentElement.style.backgroundColor = "transparent";

      let permission = await checkPermissions();

      if (permission !== "granted") {
        permission = await requestPermissions();
      }

      if (permission !== "granted") {
        alert("Aplikácia potrebuje povolenie kamery na skenovanie QR kódov.");
        await openAppSettings();
        setPage("home");
        return;
      }

      const result = await scan({
        windowed: true,
        formats: [Format.QRCode],
      });

      await cancel();

      if (!result) {
        setPage("home");
        return;
      }

      const scannedValue = result?.content?.trim() || "";
      const normalizedScan = scannedValue.toLowerCase();

      let foundRoom = null;
      let foundFloor = null;

      for (const floorKey of Object.keys(floorsData)) {
        const roomsFile = floorsData[floorKey]?.roomsFile;
        if (!roomsFile) continue;

        try {
          const response = await fetch(roomsFile);
          if (!response.ok) continue;

          const floorRooms = await response.json();

          for (const roomKey of Object.keys(floorRooms)) {
            const room = floorRooms[roomKey];
            const normalizedRoomKey = roomKey.trim().toLowerCase();

            if (normalizedScan === normalizedRoomKey) {
              foundRoom = room;
              foundFloor = floorKey;
              break;
            }
          }

          if (foundRoom) break;
        } catch (err) {
          console.error(`Chyba pri načítaní ${floorKey}:`, err);
        }
      }

      if (foundRoom) {
        setRoomText(foundRoom.text || "Popis miestnosti nie je dostupný.");
        setRoomImage(foundRoom.image || "");
        setSelectedFloor(foundFloor || "");
        setCameFromMap(false);
        setPage("detail");
      } else {
        alert(`Miestnosť pre QR "${scannedValue}" sa nenašla.`);
        setPage("home");
      }

      document.body.style.backgroundColor = "white";
      document.documentElement.style.backgroundColor = "white";
    } catch (err) {
      console.error("Chyba pri skenovaní:", err);
      console.error("message:", err?.message);
      console.error("code:", err?.code);

      setRoomText("Chyba pri načítaní QR kódu alebo dát.");
      setPage("home");
    } finally {
      setLoading(false);
    }
  };

  const goHome = async () => {
    try {
      await cancel();
    } catch (e) {
      console.log("Scanner cancel ignored:", e);
    }

    setLoading(false);
    setPage("home");
    setPanoramaLoading(false);
    setRoomText("");
    setRoomImage("");
    setCurrentRooms({});
    setSelectedFloor("");
    setCameFromMap(false);
    setRoomsDropdownOpen(false);

    document.body.style.backgroundColor = "#0a0a0a";
    document.documentElement.style.backgroundColor = "#0a0a0a";
  };

  const openFloorsList = () => {
    setRoomsDropdownOpen(false);
    setPage("floors");
  };

  const openFloorDetail = (floor) => {
    setSelectedFloor(floor);
    setRoomsDropdownOpen(false);
    setPage("floorDetail");
  };

  const goBackFromDetail = () => {
    if (cameFromMap) {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }

      setPanoramaLoading(false);
      setRoomText("");
      setRoomImage("");
      setPage("floorDetail");
      return;
    }

    goHome();
  };

  const openRoomDetail = (roomKey, room) => {
    setRoomText(room.text || roomKey || "Popis miestnosti nie je dostupný.");
    setRoomImage(room.image || "");
    setCameFromMap(true);
    setPage("detail");
  };

  const currentMap = floorsData[selectedFloor]?.map || "";
  const selectedFloorLabel = floorsData[selectedFloor]?.label || "Poschodie";

  return (
    <>
      <div className="fake-status-bar" />

      {page === "home" && (
        <div className="card-modern text-center">
          <div className="home-content">
            <h1>QR skener</h1>

            <p className="intro-text">
              Naskenujte QR kód alebo vyberte miestnosť.
            </p>

            <button
              className="btn btn-scan"
              onClick={handleScan}
              disabled={loading}
            >
              {loading ? "Skenujem..." : "Skenovať QR kód"}
            </button>

            <button className="btn btn-map" onClick={openFloorsList}>
              Vybrať miestnosť
            </button>
          </div>
        </div>
      )}

      {page === "floors" && (
        <div className="card-modern text-center">
          <div className="home-content">
            <h2>Vyberte poschodie:</h2>

            <button
              className="btn btn-map"
              onClick={() => openFloorDetail("outside")}
            >
              Vonku
            </button>

            <button
              className="btn btn-map"
              onClick={() => openFloorDetail("lobby")}
            >
              Lobby
            </button>

            <button
              className="btn btn-map"
              onClick={() => openFloorDetail("first")}
            >
              1. poschodie
            </button>

            <button
              className="btn btn-map"
              onClick={() => openFloorDetail("second")}
            >
              2. poschodie
            </button>

            <button
              className="btn btn-map"
              onClick={() => openFloorDetail("third")}
            >
              3. poschodie
            </button>

            <button className="btn btn-back" onClick={goHome}>
              ← Späť na hlavnú stránku
            </button>
          </div>
        </div>
      )}

      {page === "floorDetail" && (
        <div className="card-modern text-center">
          <div className="map-view">
            <div className="map-top-bar">
              <button className="btn btn-map btn-top-back" onClick={openFloorsList}>
                ← Späť
              </button>
            </div>

            <h2>{selectedFloorLabel}</h2>

            <div className="map-container">
              {currentMap && (
                <img src={currentMap} alt="Mapa školy" className="map-image" />
              )}

              {Object.keys(currentRooms).map((key) => {
                const room = currentRooms[key];
                const pos = room.coords;
                if (!pos) return null;

                return (
                  <div
                    key={key}
                    className="map-hotspot-indicator"
                    style={{
                      left: pos.left,
                      top: pos.top,
                    }}
                    title={key}
                    onClick={() => openRoomDetail(key, room)}
                  />
                );
              })}
            </div>

            <div className="rooms-list">
              <button
                className={`btn btn-map rooms-dropdown-toggle ${
                  roomsDropdownOpen ? "open" : ""
                }`}
                onClick={() => setRoomsDropdownOpen(!roomsDropdownOpen)}
              >
                <span>
                  {roomsDropdownOpen ? "Skryť miestnosti" : "Zobraziť miestnosti"}
                </span>
                <span
                  className={`dropdown-arrow ${roomsDropdownOpen ? "open" : ""}`}
                >
                  ▼
                </span>
              </button>

              {roomsDropdownOpen && (
                <div className="rooms-buttons">
                  {Object.keys(currentRooms).map((key) => (
                    <button
                      key={key}
                      className="room-item-btn"
                      onClick={() => openRoomDetail(key, currentRooms[key])}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {page === "scan" && (
        <div className="scanner-page">
          <div className="scanner-frame">
            <span></span>
          </div>

          <button
            className="btn-back"
            onClick={goHome}
            style={{ position: "absolute", bottom: "200px" }}
          >
            ← Späť na hlavnú stránku
          </button>
        </div>
      )}

      {page === "detail" && (
        <div className="card-detail fixed-detail text-center">
          {roomImage ? (
            <div className="panorama-wrapper">
              {panoramaLoading === true && (
                <div className="panorama-loader">
                  <Lottie
                    animationData={loaderAnimation}
                    loop={true}
                    style={{ width: 150, height: 150 }}
                  />
                  <p>Načítavam panorámu...</p>
                </div>
              )}

              {panoramaLoading === "error" && (
                <div className="panorama-loader">
                  <Lottie
                    animationData={failedAnimation}
                    loop={true}
                    style={{ width: 150, height: 150 }}
                  />
                  <p>Panoráma tejto miestnosti je nesprávne nahratá.</p>
                </div>
              )}

              <div
                id="panorama"
                className="panorama-container"
                style={{ display: panoramaLoading === "error" ? "none" : "block" }}
              />

              <button
                className="btn-back btn-back-panorama"
                onClick={goBackFromDetail}
              >
                {cameFromMap ? "← Späť na mapu" : "← Späť na hlavnú stránku"}
              </button>
            </div>
          ) : (
            <div className="card-modern text-center">
              <h2>{roomText || "Miestnosť"}</h2>
              <p className="intro-text">
                Pre túto miestnosť zatiaľ nie je nahratá panoráma.
              </p>
              <button className="btn btn-back" onClick={goBackFromDetail}>
                {cameFromMap ? "← Späť na mapu" : "← Späť na hlavnú stránku"}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default App;