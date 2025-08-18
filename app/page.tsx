"use client";

import { useState } from 'react';

const LandingPage = () => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const handleButtonClick = (category: string) => {
    setOpenDropdown(openDropdown === category ? null : category);
  };

  const commonShapes = ["Square", "Circle", "Triangle", "Rectangle"];
  const complexShapes = ["Hexagon", "Octagon", "Star", "Heart"];
  const decor = ["Flower", "Leaf", "Tree", "Animal"];
  const signs = ["Arrow", "Stop Sign", "Yield Sign", "Custom Text"];

  const renderDropdown = (category: string, shapes: string[]) => {
    if (openDropdown !== category) return null;

    return (
      <div className="absolute z-10 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
        <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
          {shapes.map((shape) => (
            <a
              key={shape}
              href="#"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              role="menuitem"
            >
              {shape}
            </a>
          ))}
        </div>
      </div>
    );
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Sheet Metal Parts Builder</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="relative">
          <button
            className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            onClick={() => handleButtonClick("commonShapes")}
          >
            Common Shapes
          </button>
          {renderDropdown("commonShapes", commonShapes)}
        </div>

        <div className="relative">
          <button
            className="px-6 py-3 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
            onClick={() => handleButtonClick("complexShapes")}
          >
            Complex Shapes
          </button>
          {renderDropdown("complexShapes", complexShapes)}
        </div>

        <div className="relative">
          <button
            className="px-6 py-3 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50"
            onClick={() => handleButtonClick("decor")}
          >
            Decor
          </button>
          {renderDropdown("decor", decor)}
        </div>

        <div className="relative">
          <button
            className="px-6 py-3 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
            onClick={() => handleButtonClick("signs")}
          >
            Signs
          </button>
          {renderDropdown("signs", signs)}
        </div>
      </div>
    </main>
  );
};

export default LandingPage;