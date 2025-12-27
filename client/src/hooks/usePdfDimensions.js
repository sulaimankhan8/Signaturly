import { useState } from "react";

export const usePdfDimensions = () => {
  const [dims, setDims] = useState({ width: 0, height: 0 });
  return { dims, setDims };
};
