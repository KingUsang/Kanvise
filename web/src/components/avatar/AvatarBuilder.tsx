import React from "react";

export interface AvatarConfig {
  skin_tone?: string;
  face_shape?: string;
  hair_style?: string;
  hair_colour?: string;
  facial_hair?: string;
  outfit_colour?: string;
  accessory?: string;
  headwear?: string;
}

interface AvatarBuilderProps {
  config: AvatarConfig;
  onChange: (key: keyof AvatarConfig, value: string) => void;
}

export const AvatarBuilder: React.FC<AvatarBuilderProps> = ({ config, onChange }) => {
  const skinTones = ["#FAD6B1", "#E2B78D", "#C48E66", "#9E6445", "#6B442A", "#3E2211"];
  const hairStyles = ["Short", "Long", "Curly", "Fade", "Bald"];
  const hairColours = ["#2b2b2b", "#5a3a22", "#d4aa5d", "#cc4747", "#cccccc"];
  const faceShapes = ["Round", "Square", "Oval", "Heart"];
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-xl font-bold text-kv-dark mb-6">Customize Avatar</h3>
      
      <div className="flex flex-col md:flex-row gap-8">
        {/* Avatar Preview (Placeholder) */}
        <div className="w-48 h-48 rounded-full border-4 border-kv-blue bg-kv-soft flex items-center justify-center mx-auto shrink-0 relative overflow-hidden">
          <div 
            className="absolute inset-0"
            style={{ backgroundColor: config.skin_tone || skinTones[0] }}
          />
          <div className="relative z-10 text-center font-semibold text-kv-dark mix-blend-overlay opacity-50">
            Preview Area
          </div>
        </div>

        {/* Controls */}
        <div className="flex-1 space-y-6">
          {/* Skin Tone */}
          <div>
            <label className="block text-sm font-semibold text-kv-dark mb-2">Skin Tone</label>
            <div className="flex gap-3">
              {skinTones.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => onChange("skin_tone", tone)}
                  className={`w-10 h-10 rounded-full transition-transform ${
                    config.skin_tone === tone ? "ring-2 ring-offset-2 ring-kv-blue scale-110" : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: tone }}
                />
              ))}
            </div>
          </div>

          {/* Hair Style */}
          <div>
            <label className="block text-sm font-semibold text-kv-dark mb-2">Hair Style</label>
            <div className="flex flex-wrap gap-2">
              {hairStyles.map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => onChange("hair_style", style)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    config.hair_style === style 
                      ? "bg-kv-blue text-white" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Hair Colour */}
          <div>
            <label className="block text-sm font-semibold text-kv-dark mb-2">Hair Colour</label>
            <div className="flex gap-3">
              {hairColours.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onChange("hair_colour", color)}
                  className={`w-10 h-10 rounded-full transition-transform ${
                    config.hair_colour === color ? "ring-2 ring-offset-2 ring-kv-blue scale-110" : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Face Shape */}
          <div>
            <label className="block text-sm font-semibold text-kv-dark mb-2">Face Shape</label>
            <select 
              className="w-full md:w-1/2 px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-kv-blue/20 focus:border-kv-blue"
              value={config.face_shape || ""}
              onChange={(e) => onChange("face_shape", e.target.value)}
            >
              <option value="" disabled>Select shape</option>
              {faceShapes.map(shape => (
                <option key={shape} value={shape}>{shape}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
