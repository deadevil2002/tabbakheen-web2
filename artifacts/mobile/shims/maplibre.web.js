// Web stub for @maplibre/maplibre-react-native — native-only module.
// On web the maps are gated off (Platform.OS !== 'web'), so these stubs simply
// keep the import resolvable without pulling in native code.
const React = require("react");
const { View } = require("react-native");

function MapStub(props) {
  return React.createElement(View, { style: props.style }, props.children || null);
}

function NullStub() {
  return null;
}

module.exports = {
  Map: MapStub,
  Camera: NullStub,
  Marker: NullStub,
  UserLocation: NullStub,
  GeoJSONSource: NullStub,
  Layer: NullStub,
};
module.exports.default = module.exports;
