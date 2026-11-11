
export function featureToGenbankLocationString(feat) {
  const [ inclusive1BasedStart, inclusive1BasedEnd ] = [false, false];
  let locStr = "";

  if (feat.locations && feat.locations.length > 1) {
    feat.locations.forEach((loc, i) => {
      locStr +=`${parseInt(loc.start, 10) + (inclusive1BasedStart ? 0 : 1)}..${parseInt(loc.end, 10) + (inclusive1BasedEnd ? 0 : 1)}`;
      if (i !== feat.locations.length - 1) {
        locStr += ",";
      }
    });
    locStr = "join(" + locStr + ")";
  } else {
    locStr +=`${parseInt(feat.start, 10) + (inclusive1BasedStart ? 0 : 1)}..${parseInt(feat.end, 10) + (inclusive1BasedEnd ? 0 : 1)}`;
  }

  if (feat.strand === -1) {
    locStr = "complement(" + locStr + ")";
  }
  return locStr;
}
