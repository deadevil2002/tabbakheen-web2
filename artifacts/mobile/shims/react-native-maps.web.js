// Web stub for react-native-maps — not supported on web
const React = require("react");
const { View } = require("react-native");

function MapViewStub(props) {
  return React.createElement(View, { style: props.style });
}

function MarkerStub() {
  return null;
}

function PolylineStub() {
  return null;
}

MapViewStub.Animated = MapViewStub;

module.exports = MapViewStub;
module.exports.default = MapViewStub;
module.exports.Marker = MarkerStub;
module.exports.Polyline = PolylineStub;
module.exports.PROVIDER_GOOGLE = "google";
module.exports.PROVIDER_DEFAULT = null;
