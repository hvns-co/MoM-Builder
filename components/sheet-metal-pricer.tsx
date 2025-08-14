"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';

// --- Data & Constants ---
const materialThicknesses: Record<string, { value: string, text: string }[]> = {
    aluminum_3003: [ { value: '0.032', text: '0.032" (20 ga)' }, { value: '0.063', text: '0.063" (14 ga)' }, { value: '0.125', text: '0.125" (1/8")' } ],
    stainless_304: [ { value: '0.030', text: '0.030" (22 ga)' }, { value: '0.060', text: '0.060" (16 ga)' }, { value: '0.120', text: '0.120" (~1/8")' } ],
    mild_steel_a36: [ { value: '0.059', text: '0.059" (16 ga)' }, { value: '0.119', text: '0.119" (11 ga)' }, { value: '0.179', text: '0.179" (7 ga)' } ],
};
const materials: Record<string, string> = {
    aluminum_3003: 'Aluminum 3003',
    stainless_304: 'Stainless Steel 304',
    mild_steel_a36: 'Mild Steel A36',
};
const finishings: Record<string, string> = {
    none: 'None (Raw Material)',
    powder_coated: 'Powder Coated',
    matte: 'Matte Finish (Ready for Paint)',
    custom: 'Custom Finishing',
};
const templateDisplayNames: Record<string, string> = {
    rectangle: 'Rectangle / Square', circle: 'Circle / Disc',
    rect_holes: 'Rectangle w/ Holes', triangle_holes: 'Triangle w/ Holes'
};
const costPerSecondCutting = 0.05 * 1.75;
const minimumPartCost = 1.50 * 1.75;
const pricingData: Record<string, Record<string, { costPerSqInch: number, cutSpeedInPerSec: number }>> = {
    aluminum_3003: { '0.032': { costPerSqInch: 0.05 * 1.75, cutSpeedInPerSec: 5 }, '0.063': { costPerSqInch: 0.05 * 1.75, cutSpeedInPerSec: 5 }, '0.125': { costPerSqInch: 0.07 * 1.75, cutSpeedInPerSec: 3 } },
    stainless_304: { '0.030': { costPerSqInch: 0.10 * 1.75, cutSpeedInPerSec: 5 }, '0.060': { costPerSqInch: 0.10 * 1.75, cutSpeedInPerSec: 5 }, '0.120': { costPerSqInch: 0.15 * 1.75, cutSpeedInPerSec: 3 } },
    mild_steel_a36: { '0.059': { costPerSqInch: 0.05 * 1.75, cutSpeedInPerSec: 5 }, '0.119': { costPerSqInch: 0.07 * 1.75, cutSpeedInPerSec: 3 }, '0.179': { costPerSqInch: 0.07 * 1.75, cutSpeedInPerSec: 3 } }
};
const quantityDiscounts = [
    { range: '1-20', minQty: 1, multiplier: 1.0 }, { range: '21-50', minQty: 21, multiplier: 0.90 },
    { range: '51-100', minQty: 51, multiplier: 0.80 }, { range: '101+', minQty: 101, multiplier: 0.50 }
];
const SVG_VIEWBOX_SIZE = 100;
const SVG_PADDING = 5;
const SVG_MAX_DIMENSION = SVG_VIEWBOX_SIZE - (SVG_PADDING * 2);

const initialState = {
    template: '', width: '', height: '', diameter: '', triBase: '', triHeight: '',
    holeDiameter: '', holeOffset: '', material: '', other_material: '',
    thickness: '', other_thickness: '', quantity: '1', finishing: 'none',
    powder_coat_color: '', custom_finish_description: '',
};

// ====================================================================
// STEP 1: Define SvgVisualization as a standalone component
// It now accepts props to get the data it needs.
// ====================================================================
interface SvgVisualizationProps {
    formState: typeof initialState;
    previewTemplate: string;
}

const SvgVisualization: React.FC<SvgVisualizationProps> = ({ formState, previewTemplate }) => {
    const { template: currentTemplate, width, height, diameter, triBase, triHeight, holeDiameter, holeOffset } = formState;
    const template = previewTemplate || currentTemplate;

    const PREVIEW_RECT_WIDTH = 70, PREVIEW_RECT_HEIGHT = 50;
    const PREVIEW_CIRCLE_RADIUS = 30;
    const PREVIEW_TRI_BASE = 70, PREVIEW_TRI_HEIGHT = 60;
    const PREVIEW_HOLE_DIA = 8, PREVIEW_HOLE_OFFSET = 10;
    
    let w = parseFloat(width) || 0, h = parseFloat(height) || 0, d = parseFloat(diameter) || 0;
    let tBase = parseFloat(triBase) || 0, tHeight = parseFloat(triHeight) || 0;
    let hDia = parseFloat(holeDiameter) || 0, hOff = parseFloat(holeOffset) || 0;

    if (previewTemplate) {
        if (template === 'rectangle') { w = PREVIEW_RECT_WIDTH; h = PREVIEW_RECT_HEIGHT; }
        else if (template === 'circle') { d = PREVIEW_CIRCLE_RADIUS * 2; }
        else if (template === 'rect_holes') { w = PREVIEW_RECT_WIDTH; h = PREVIEW_RECT_HEIGHT; hDia = PREVIEW_HOLE_DIA; hOff = PREVIEW_HOLE_OFFSET; }
        else if (template === 'triangle_holes') { tBase = PREVIEW_TRI_BASE; tHeight = PREVIEW_TRI_HEIGHT; hDia = PREVIEW_HOLE_DIA; hOff = PREVIEW_HOLE_OFFSET; }
    }
    
    const shapes = useMemo(() => {
        const vecSub = (v1:any, v2:any) => ({ x: v1.x - v2.x, y: v1.y - v2.y });
        const vecAdd = (v1:any, v2:any) => ({ x: v1.x + v2.x, y: v1.y + v2.y });
        const vecScale = (v:any, s:number) => ({ x: v.x * s, y: v.y * s });
        const vecMag = (v:any) => Math.sqrt(v.x * v.x + v.y * v.y);
        const vecNorm = (v:any) => { const m = vecMag(v); return m === 0 ? {x:0, y:0} : { x: v.x / m, y: v.y / m }; };

        let calculatedShapes: JSX.Element[] = [];
        let scaleFactor = 1;

        if (template === 'rectangle' || template === 'rect_holes') {
            if (w > 0 && h > 0) {
                const maxDim = Math.max(w, h);
                scaleFactor = maxDim > 0 ? SVG_MAX_DIMENSION / maxDim : 1;
                const scaledW = w * scaleFactor, scaledH = h * scaleFactor;
                const x = (SVG_VIEWBOX_SIZE - scaledW) / 2, y = (SVG_VIEWBOX_SIZE - scaledH) / 2;
                calculatedShapes.push(<rect key="rect" x={x} y={y} width={scaledW} height={scaledH} className={`base-shape ${previewTemplate ? 'preview' : ''}`} />);
                
                if (template === 'rect_holes' && hDia > 0 && hOff > 0) {
                    const scaledHoleR = (hDia / 2) * scaleFactor;
                    const scaledHoleO = hOff * scaleFactor;
                    if (!previewTemplate && (hOff * 2 >= w || hOff * 2 >= h || hDia >= Math.min(w,h))) {}
                    else {
                        const holeCoords = [
                            { cx: x + scaledHoleO, cy: y + scaledHoleO }, { cx: x + scaledW - scaledHoleO, cy: y + scaledHoleO },
                            { cx: x + scaledHoleO, cy: y + scaledH - scaledHoleO }, { cx: x + scaledW - scaledHoleO, cy: y + scaledH - scaledHoleO },
                        ];
                        holeCoords.forEach((hole, i) => calculatedShapes.push(<circle key={`h${i}`} {...hole} r={scaledHoleR} className={`hole ${previewTemplate ? 'preview' : ''}`} />));
                    }
                }
            }
        } else if (template === 'circle') {
            if (d > 0) {
                scaleFactor = d > 0 ? SVG_MAX_DIMENSION / d : 1;
                const scaledR = (d / 2) * scaleFactor;
                calculatedShapes.push(<circle key="circle" cx="50" cy="50" r={scaledR} className={`base-shape ${previewTemplate ? 'preview' : ''}`} />)
            }
        } else if (template === 'triangle_holes') {
             if (tBase > 0 && tHeight > 0) {
                const maxDim = Math.max(tBase, tHeight);
                scaleFactor = maxDim > 0 ? SVG_MAX_DIMENSION / maxDim : 1;
                const sb = tBase * scaleFactor, sh = tHeight * scaleFactor;
                const p1x = (SVG_VIEWBOX_SIZE - sb) / 2, p1y = (SVG_VIEWBOX_SIZE + sh) / 2;
                const p2x = p1x + sb, p2y = p1y;
                const p3x = p1x + sb/2, p3y = p1y - sh;
                calculatedShapes.push(<polygon key="tri" points={`${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}`} className={`base-shape ${previewTemplate ? 'preview' : ''}`} />);
                
                if (hDia > 0 && hOff > 0) {
                    if (!previewTemplate && (hOff * 2 >= Math.min(tBase, tHeight) || hDia >= Math.min(tBase, tHeight))) { /* Don't draw invalid holes */ }
                    else {
                        const scaledHoleR = (hDia / 2) * scaleFactor;
                        const scaledHoleO = hOff * scaleFactor;
                                                
                        const vertices = [{x:p1x, y:p1y}, {x:p2x, y:p2y}, {x:p3x, y:p3y}];
                        for (let i = 0; i < 3; i++) {
                            const P = vertices[i];
                            const P_prev = vertices[(i + 2) % 3]; const P_next = vertices[(i + 1) % 3];
                            const v_prev = vecSub(P_prev, P); const v_next = vecSub(P_next, P);
                            const n_prev = vecNorm(v_prev); const n_next = vecNorm(v_next);
                            let bisector = vecNorm(vecAdd(n_prev, n_next));
                            const midOpposite = {x: (P_prev.x + P_next.x)/2, y: (P_prev.y + P_next.y)/2 };
                            const vecToMid = vecSub(midOpposite, P);
                            if (bisector.x * vecToMid.x + bisector.y * vecToMid.y < 0) { bisector = vecScale(bisector, -1); }
                            const holeCenterX = P.x + bisector.x * scaledHoleO;
                            const holeCenterY = P.y + bisector.y * scaledHoleO;
                            calculatedShapes.push(<circle key={`h${i}`} cx={holeCenterX} cy={holeCenterY} r={scaledHoleR} className={`hole ${previewTemplate ? 'preview' : ''}`} />);
                        }
                    }
                }
            }
        }
        return calculatedShapes;
    }, [w, h, d, tBase, tHeight, hDia, hOff, template, previewTemplate]);
    
    const svgStyles = `
        .base-shape {
            fill: #a5b4fc;
            stroke: #4f46e5; 
            stroke-width: 1;
            vector-effect: non-scaling-stroke;
        }
        .base-shape.preview {
            fill: #e0e7ff; 
            stroke: #a5b4fc;
        }
        .hole {
            fill: white;
            stroke: #ec4899; 
            stroke-width: 0.5;
            vector-effect: non-scaling-stroke;
        }
        .hole.preview { 
            fill: #fbcfe8;
            stroke: #f472b6; 
        }
    `;

    return (
        <svg width="90%" height="90%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            <defs>
                <style>{svgStyles}</style>
            </defs>
            {shapes.length > 0 ? shapes : <text x="50" y="50" fontSize="8" textAnchor="middle" dominantBaseline="middle" fill="#6b7280">Select template & dimensions</text>}
        </svg>
    )
};


export default function SheetMetalPricer() {
    const [formState, setFormState] = useState(initialState);
    const [previewTemplate, setPreviewTemplate] = useState('');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormState(prevState => ({ ...prevState, [name]: value }));
    };

    const handleTemplateClick = (template: string) => {
        setFormState(prevState => ({
            ...initialState,
            template: template,
            quantity: prevState.quantity,
            material: prevState.material,
            thickness: prevState.thickness,
            other_material: prevState.other_material,
            other_thickness: prevState.other_thickness,
            finishing: prevState.finishing,
            powder_coat_color: prevState.powder_coat_color,
            custom_finish_description: prevState.custom_finish_description,
        }));
    };

    const calculationResults = useMemo(() => {
        const {
            template, width, height, diameter, triBase, triHeight,
            holeDiameter, holeOffset, material, other_material,
            thickness, other_thickness, quantity: qtyStr, finishing,
            powder_coat_color, custom_finish_description
        } = formState;

        let localIsValid = true;
        let costIsEstimate = true;
        let baseArea = 0;
        let perimeter = 0;
        let numHoles = 0;
        let holeCutLength = 0;
        let localCost = 0;
        const localPriceTiers = { tier1: 'N/A', tier2: 'N/A', tier3: 'N/A', tier4: 'N/A' };

        const w = parseFloat(width) || 0;
        const h = parseFloat(height) || 0;
        const d = parseFloat(diameter) || 0;
        const tBase = parseFloat(triBase) || 0;
        const tHeight = parseFloat(triHeight) || 0;
        const hDia = parseFloat(holeDiameter) || 0;
        const hOff = parseFloat(holeOffset) || 0;
        const quantity = parseInt(qtyStr) || 1;

        if (!template) {
            localIsValid = false;
        } else if (template === 'rectangle' || template === 'rect_holes') {
            if (w > 0 && h > 0) { baseArea = w * h; perimeter = 2 * (w + h); } else { localIsValid = false; }
            if (template === 'rect_holes') numHoles = 4;
        } else if (template === 'circle') {
            if (d > 0) { baseArea = Math.PI * (d / 2) ** 2; perimeter = Math.PI * d; } else { localIsValid = false; }
        } else if (template === 'triangle_holes') {
            if (tBase > 0 && tHeight > 0) {
                baseArea = 0.5 * tBase * tHeight;
                const sideLength = Math.sqrt((tBase / 2) ** 2 + tHeight ** 2);
                perimeter = tBase + 2 * sideLength;
                numHoles = 3;
            } else { localIsValid = false; }
        }

        if (numHoles > 0) {
            if (hDia > 0 && hOff > 0) {
                let smallestDim = 0;
                if (template === 'rect_holes') smallestDim = Math.min(w, h);
                else if (template === 'triangle_holes') smallestDim = Math.min(tBase, tHeight);
                if (smallestDim > 0 && (hOff * 2 >= smallestDim || hDia >= smallestDim)) {
                     localIsValid = false;
                } else {
                    holeCutLength = numHoles * (Math.PI * hDia);
                }
            } else { localIsValid = false; }
        }

        if (finishing === 'powder_coated' && !powder_coat_color) localIsValid = false;
        if (finishing === 'custom' && !custom_finish_description) localIsValid = false;

        const isOtherMaterial = material === 'other';
        const isOtherThickness = thickness === 'other';

        if ((isOtherMaterial && !other_material) || (isOtherThickness && !other_thickness)) {
            localIsValid = false;
        }

        if(isOtherMaterial || isOtherThickness) {
            costIsEstimate = false;
            localIsValid = false; 
        }

        if (localIsValid && material && thickness && template) {
            const materialPricing = pricingData[material]?.[thickness];
            if (materialPricing) {
                const { costPerSqInch, cutSpeedInPerSec } = materialPricing;
                const materialCost = baseArea * costPerSqInch;
                const totalCutLength = perimeter + holeCutLength;
                const cuttingTimeInSeconds = totalCutLength / cutSpeedInPerSec;
                const cuttingCost = cuttingTimeInSeconds * costPerSecondCutting;
                const baseCostPerPart = materialCost + cuttingCost;

                quantityDiscounts.forEach((tier, index) => {
                    const tierPrice = Math.max(baseCostPerPart * tier.multiplier, minimumPartCost).toFixed(2);
                    localPriceTiers[`tier${index+1}` as keyof typeof localPriceTiers] = `$${tierPrice}`;
                });

                let currentDiscountMultiplier = 1.0;
                for (let i = quantityDiscounts.length - 1; i >= 0; i--) {
                    if (quantity >= quantityDiscounts[i].minQty) {
                        currentDiscountMultiplier = quantityDiscounts[i].multiplier;
                        break;
                    }
                }
                
                const currentDiscountedCostPerPart = baseCostPerPart * currentDiscountMultiplier;
                const currentFinalCostPerPart = Math.max(currentDiscountedCostPerPart, minimumPartCost);
                localCost = currentFinalCostPerPart * quantity;
            } else { localIsValid = false; }
        } else {
             if (!costIsEstimate) {
                localIsValid = false;
             } else {
                localIsValid = false;
             }
        }
        
        return { isValid: localIsValid, cost: localCost, priceTiers: localPriceTiers, costIsEstimate };
    }, [formState]);
    
    const renderParameterInputs = () => {
        const { template } = formState;
        const inputClass = "bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-md shadow-sm p-2 w-full focus-ring parameter-input";
        
        let dimensionInputs = null;
        let holeInputs = null;

        if (template === 'rectangle' || template === 'rect_holes') {
            dimensionInputs = (
                <>
                    <div><label htmlFor="width" className="block text-sm font-medium text-gray-700 mb-1">Width (inches):</label><input type="number" id="width" name="width" value={formState.width} onChange={handleInputChange} min="0.1" step="0.01" placeholder="e.g., 10.5" className={inputClass} /></div>
                    <div><label htmlFor="height" className="block text-sm font-medium text-gray-700 mb-1">Height (inches):</label><input type="number" id="height" name="height" value={formState.height} onChange={handleInputChange} min="0.1" step="0.01" placeholder="e.g., 5.25" className={inputClass} /></div>
                </>
            );
        } else if (template === 'circle') {
            dimensionInputs = (
                <div><label htmlFor="diameter" className="block text-sm font-medium text-gray-700 mb-1">Diameter (inches):</label><input type="number" id="diameter" name="diameter" value={formState.diameter} onChange={handleInputChange} min="0.1" step="0.01" placeholder="e.g., 8.0" className={inputClass} /></div>
            );
        } else if (template === 'triangle_holes') {
            dimensionInputs = (
                <>
                    <div><label htmlFor="triBase" className="block text-sm font-medium text-gray-700 mb-1">Base (inches):</label><input type="number" id="triBase" name="triBase" value={formState.triBase} onChange={handleInputChange} min="0.1" step="0.01" placeholder="e.g., 6.0" className={inputClass} /></div>
                    <div><label htmlFor="triHeight" className="block text-sm font-medium text-gray-700 mb-1">Height (inches):</label><input type="number" id="triHeight" name="triHeight" value={formState.triHeight} onChange={handleInputChange} min="0.1" step="0.01" placeholder="e.g., 5.0" className={inputClass} /></div>
                </>
            );
        }

        if (template === 'rect_holes' || template === 'triangle_holes') {
            holeInputs = (
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-medium text-gray-600 mb-2">Hole Parameters:</h3>
                    <div><label htmlFor="holeDiameter" className="block text-sm font-medium text-gray-700 mb-1">Hole Diameter (inches):</label><input type="number" id="holeDiameter" name="holeDiameter" value={formState.holeDiameter} onChange={handleInputChange} min="0.01" step="0.001" placeholder="e.g., 0.25" className={inputClass} /></div>
                    <div className="mt-2"><label htmlFor="holeOffset" className="block text-sm font-medium text-gray-700 mb-1">Corner/Vertex Offset (inches):</label><input type="number" id="holeOffset" name="holeOffset" value={formState.holeOffset} onChange={handleInputChange} min="0.01" step="0.001" placeholder="e.g., 0.5" className={inputClass} /></div>
                </div>
            );
        }

        if (!dimensionInputs) {
            return <p className="text-gray-500 italic">Select a template to see dimension options.</p>;
        }

        return <div className="space-y-4">{dimensionInputs}{holeInputs}</div>;
    };

    const renderThicknessOptions = useCallback(() => {
        const { material } = formState;
        const options: JSX.Element[] = [<option key="" value="">-- Select Thickness --</option>];
        
        if (material && material !== 'other') {
            const thicknesses = materialThicknesses[material as keyof typeof materialThicknesses] || [];
            thicknesses.forEach(opt => {
                if(pricingData[material]?.[opt.value]) {
                    options.push(<option key={opt.value} value={opt.value}>{opt.text}</option>);
                }
            });
        } else if (!material) {
            return [<option key="disabled" value="">-- Select Material First --</option>];
        }
        
        if (material) {
            options.push(<option key="other" value="other">Other...</option>);
        }

        return options;
    }, [formState.material]);

    useEffect(() => {
        const { material, thickness } = formState;
        if (material && material !== 'other') {
            const availableThicknesses = materialThicknesses[material]?.map(t => t.value) || [];
            if (thickness && !availableThicknesses.includes(thickness) && thickness !== 'other') {
                setFormState(fs => ({ ...fs, thickness: '' }));
            }
        }
    }, [formState.material, formState.thickness]);

    const renderSummary = () => {
        const { template, width, height, diameter, triBase, triHeight, holeDiameter, holeOffset, material, other_material, thickness, other_thickness, quantity, finishing, powder_coat_color, custom_finish_description } = formState;
        
        let dimSummary = null;
        if (template === 'rectangle' || template === 'rect_holes') {
            dimSummary = <>
                <div className="flex justify-between"><span className="text-gray-600">Width:</span> <span className="font-medium text-gray-800">{width || 'N/A'}"</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Height:</span> <span className="font-medium text-gray-800">{height || 'N/A'}"</span></div>
            </>;
        } else if (template === 'circle') {
            dimSummary = <div className="flex justify-between"><span className="text-gray-600">Diameter:</span> <span className="font-medium text-gray-800">{diameter || 'N/A'}"</span></div>;
        } else if (template === 'triangle_holes') {
            dimSummary = <>
                <div className="flex justify-between"><span className="text-gray-600">Base:</span> <span className="font-medium text-gray-800">{triBase || 'N/A'}"</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Height:</span> <span className="font-medium text-gray-800">{triHeight || 'N/A'}"</span></div>
            </>;
        }

        let holeSummary = null;
        if (template === 'rect_holes' || template === 'triangle_holes') {
            holeSummary = (
                <div id="summary-holes">
                    <div className="flex justify-between"><span className="text-gray-600">Hole Dia:</span> <span className="font-medium text-gray-800">{holeDiameter || 'N/A'}"</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Hole Offset:</span> <span className="font-medium text-gray-800">{holeOffset || 'N/A'}"</span></div>
                </div>
            );
        }

        const materialText = material && material !== 'other' ? materials[material] : (other_material || 'N/A');
        const thicknessText = thickness && thickness !== 'other' && material && material !== 'other'
            ? materialThicknesses[material]?.find(t => t.value === thickness)?.text || (other_thickness || 'N/A')
            : (other_thickness || 'N/A');
        const finishingText = finishings[finishing] || 'None';

        return (
             <div className="space-y-2 text-sm mb-6 bg-white p-4 rounded-md border border-gray-200">
                <h3 className="font-semibold text-gray-700 mb-2">Configuration:</h3>
                <div className="flex justify-between"><span className="text-gray-600">Template:</span> <span className="font-medium text-gray-800">{templateDisplayNames[template] || 'N/A'}</span></div>
                {dimSummary}
                {holeSummary}
                <div className="flex justify-between"><span className="text-gray-600">Material:</span> <span className="font-medium text-gray-800">{material === 'other' ? 'Other (Requested)' : materialText}</span></div>
                {material === 'other' && other_material && <div className="text-xs pl-2">Requested: <span className="font-medium">{other_material}</span></div>}
                <div className="flex justify-between"><span className="text-gray-600">Thickness:</span> <span className="font-medium text-gray-800">{thickness === 'other' ? 'Other (Requested)' : thicknessText}</span></div>
                {thickness === 'other' && other_thickness && <div className="text-xs pl-2">Requested: <span className="font-medium">{other_thickness}</span></div>}
                <div className="pt-2 mt-2 border-t border-gray-100">
                    <div className="flex justify-between"><span className="text-gray-600">Finishing:</span> <span className="font-medium text-gray-800">{finishingText}</span></div>
                    {finishing === 'powder_coated' && powder_coat_color && <div className="text-xs pl-2">Color Code: <span className="font-medium">{powder_coat_color}</span></div>}
                    {finishing === 'custom' && custom_finish_description && <div className="text-xs pl-2">Desc: <span className="font-medium">{custom_finish_description}</span></div>}
                </div>
                <div className="pt-2 mt-2 border-t border-gray-100">
                    <div className="flex justify-between"><span className="text-gray-600">Quantity:</span> <span className="font-medium text-gray-800">{quantity}</span></div>
                </div>
            </div>
        )
    };
    
    return (
        <div className="bg-gray-100 p-4 md:p-8">
            <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
                <header className="bg-gradient-to-r from-indigo-600 to-blue-500 p-6 text-white">
                    <h1 className="text-2xl md:text-3xl font-bold">Sheet Metal Parts Builder</h1>
                    <p className="text-indigo-100 mt-1">Configure your custom laser-cut parts</p>
                </header>

                <div className="flex flex-col md:flex-row">
                    <div className="w-full md:w-2/3 p-6 space-y-6 border-r border-gray-200">
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Select Template:</label>
                            <div className="template-selector-container">
                                {Object.entries(templateDisplayNames).map(([key, name]) => (
                                    <button 
                                        key={key} 
                                        onClick={() => handleTemplateClick(key)}
                                        onMouseEnter={() => setPreviewTemplate(key)}
                                        onMouseLeave={() => setPreviewTemplate('')}
                                        className={`template-option ${formState.template === key ? 'selected' : ''}`}>
                                        {name}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div id="parameter-inputs" className="space-y-4">
                            {renderParameterInputs()}
                        </div>

                        <div>
                            <label htmlFor="material" className="block text-sm font-medium text-gray-700 mb-1">Select Material:</label>
                            <select id="material" name="material" value={formState.material} onChange={handleInputChange} className="bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-md shadow-sm p-2 w-full focus-ring">
                                <option value="">-- Select Material --</option>
                                {Object.entries(materials).map(([key, name]) => (
                                    <option key={key} value={key}>{name}</option>
                                ))}
                                <option value="other">Other...</option>
                            </select>
                            {formState.material === 'other' && (
                                <div className="other-details" style={{display: 'block', marginTop: '0.5rem'}}>
                                    <label htmlFor="other_material" className="block text-xs font-medium text-gray-600 mb-1">Requested Material:</label>
                                    <input type="text" id="other_material" name="other_material" value={formState.other_material} onChange={handleInputChange} placeholder="Input Requested Material" className="other-input bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-md shadow-sm p-2 w-full focus-ring" />
                                </div>
                            )}
                        </div>

                        <div>
                            <label htmlFor="thickness" className="block text-sm font-medium text-gray-700 mb-1">Select Thickness (gauge/inches):</label>
                            <select id="thickness" name="thickness" value={formState.thickness} onChange={handleInputChange} className="bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-md shadow-sm p-2 w-full focus-ring" disabled={!formState.material}>
                                {renderThicknessOptions()}
                            </select>
                            {formState.thickness === 'other' && (
                                <div className="other-details" style={{display: 'block', marginTop: '0.5rem'}}>
                                    <label htmlFor="other_thickness" className="block text-xs font-medium text-gray-600 mb-1">Requested Thickness:</label>
                                    <input type="text" id="other_thickness" name="other_thickness" value={formState.other_thickness} onChange={handleInputChange} placeholder="Input Requested Thickness" className="other-input bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-md shadow-sm p-2 w-full focus-ring" />
                                </div>
                            )}
                        </div>
                        
                        <div>
                            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">Quantity:</label>
                            <input type="number" id="quantity" name="quantity" value={formState.quantity} onChange={handleInputChange} min="1" className="bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-md shadow-sm p-2 w-full focus-ring" />
                        </div>

                        <div>
                            <label htmlFor="finishing" className="block text-sm font-medium text-gray-700 mb-1">Finishing:</label>
                            <select id="finishing" name="finishing" value={formState.finishing} onChange={handleInputChange} className="bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-md shadow-sm p-2 w-full focus-ring">
                                {Object.entries(finishings).map(([key, name]) => (
                                    <option key={key} value={key}>{name}</option>
                                ))}
                            </select>
                            {formState.finishing === 'powder_coated' && (
                                <div className="finishing-details" style={{display: 'block', marginTop: '0.5rem'}}>
                                    <label htmlFor="powder_coat_color" className="block text-xs font-medium text-gray-600 mb-1">Powder Coat Color Code:</label>
                                    <input type="text" id="powder_coat_color" name="powder_coat_color" value={formState.powder_coat_color} onChange={handleInputChange} placeholder="e.g., RAL 9005" className="finishing-input bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-md shadow-sm p-2 w-full focus-ring" />
                                </div>
                            )}
                            {formState.finishing === 'custom' && (
                                <div className="finishing-details" style={{display: 'block', marginTop: '0.5rem'}}>
                                    <label htmlFor="custom_finish_description" className="block text-xs font-medium text-gray-600 mb-1">Custom Finish Description:</label>
                                    <textarea id="custom_finish_description" name="custom_finish_description" value={formState.custom_finish_description} onChange={handleInputChange} rows={3} placeholder="e.g., Polished edges, light patina on face" className="finishing-input bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-md shadow-sm p-2 w-full focus-ring"></textarea>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="w-full md:w-1/3 p-6 bg-gray-50">
                        <h2 className="text-xl font-semibold text-gray-800 border-b pb-2 mb-6">2. Summary & Estimate</h2>
                        <div id="svg-container" className="mb-6 flex items-center justify-center w-full h-[160px] border border-dashed border-gray-300 rounded-md bg-white overflow-hidden">
                           <SvgVisualization formState={formState} previewTemplate={previewTemplate} />
                        </div>
                        
                        {renderSummary()}
                        
                        <div className="bg-indigo-50 p-4 rounded-md border border-indigo-200">
                            <div className="flex justify-between items-baseline">
                                <div>
                                    <h3 className="font-semibold text-gray-700 mb-0">Estimated Cost:</h3>
                                    <p className="text-2xl font-bold text-indigo-700">{calculationResults.costIsEstimate ? `$${calculationResults.cost.toFixed(2)}` : 'N/A'}</p>
                                </div>
                                <div className="text-right">
                                    <h3 className="font-semibold text-gray-700 mb-0 text-sm">Lead Time:</h3>
                                    <p className="text-sm font-medium text-gray-800">{calculationResults.costIsEstimate ? `~1 week` : 'N/A'}</p>
                                </div>
                            </div>
                            {!calculationResults.costIsEstimate && (
                                <p className="unavailable-message mt-2">Estimated cost and lead time unavailable for custom requests.</p>
                            )}
                            {calculationResults.costIsEstimate && calculationResults.isValid && (
                                <div className="text-xs mt-4 pt-2 border-t border-indigo-100">
                                    <h4 className="font-medium text-gray-600 mb-1">Quantity Discounts (per piece):</h4>
                                    {quantityDiscounts.map((tier, index) => (
                                        <div key={tier.range} className="quantity-pricing-item">
                                            <span>{tier.range}:</span>
                                            <span>{calculationResults.priceTiers[`tier${index + 1}` as keyof typeof calculationResults.priceTiers]}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <p className="text-xs text-gray-500 mt-3">Estimates do not include shipping time. Final price & lead time may vary.</p>
                        </div>
                        <div className="mt-6">
                            <button id="add-to-cart-btn" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md focus-ring transition-colors duration-200 disabled:opacity-50" disabled={!calculationResults.isValid || !calculationResults.costIsEstimate || calculationResults.cost <= 0}>
                                Add to Cart (Placeholder)
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .focus-ring { @apply focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:outline-none; }
                .template-selector-container { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.25rem; }
                .template-option {
                    padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 0.375rem; cursor: pointer;
                    transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out, color 0.2s ease-in-out;
                    background-color: white; color: #374151; font-size: 0.875rem; line-height: 1.25rem;
                }
                .template-option:hover { background-color: #f3f4f6; border-color: #a5b4fc; }
                .template-option.selected { background-color: #e0e7ff; border-color: #6366f1; color: #4338ca; font-weight: 500; }

                select:disabled { @apply bg-gray-200 text-gray-500 cursor-not-allowed; }
                
                .unavailable-message {
                    @apply text-sm text-red-600 font-medium;
                }
                .quantity-pricing-item {
                    @apply flex justify-between items-center text-xs;
                }
                 .quantity-pricing-item:not(:first-child) {
                    @apply border-t border-indigo-100 pt-1 mt-1;
                 }
                 .quantity-pricing-item span:first-child {
                     @apply text-gray-600;
                 }
                 .quantity-pricing-item span:last-child {
                     @apply font-medium text-gray-800;
                 }
            `}</style>
        </div>
    );
}
