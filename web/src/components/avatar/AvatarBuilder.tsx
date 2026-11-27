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

const FACE_RADII: Record<string, [number, number]> = {
  Round: [30, 32],
  Square: [30, 30],
  Oval: [26, 36],
  Heart: [30, 34],
};

function AvatarPreview({ config, skin }: { config: AvatarConfig; skin: string }) {
  const hair = config.hair_colour || "#2b2b2b";
  const style = config.hair_style || "Short";
  const [rx, ry] = FACE_RADII[config.face_shape ?? "Round"] ?? FACE_RADII.Round;
  const summary = `Avatar preview: ${config.face_shape ?? "Round"} face, ${style.toLowerCase()} hair`;
  return (
    <div className="mx-auto h-48 w-48 shrink-0 overflow-hidden rounded-full border-4 border-kv-blue bg-kv-soft">
      <svg viewBox="0 0 100 100" role="img" aria-label={summary} className="h-full w-full">
        {style === "Long" && <rect x="20" y="30" width="60" height="55" rx="18" fill={hair} />}
        {style === "Curly" && <circle cx="50" cy="38" r="31" fill={hair} />}
        <ellipse cx="50" cy="52" rx={rx} ry={ry} fill={skin} />
        {style === "Short" && <path d="M20 46 Q50 6 80 46 Q50 28 20 46Z" fill={hair} />}
        {style === "Fade" && <path d="M22 44 Q50 14 78 44 Q50 34 22 44Z" fill={hair} />}
        {style === "Long" && <path d="M20 46 Q50 8 80 46 Q50 26 20 46Z" fill={hair} />}
        {style === "Curly" && <path d="M20 46 Q50 10 80 46 Q50 26 20 46Z" fill={hair} />}
        <circle cx="40" cy="52" r="2.5" fill="#2b2b2b" />
        <circle cx="60" cy="52" r="2.5" fill="#2b2b2b" />
        <path d="M42 66 Q50 72 58 66" stroke="#2b2b2b" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
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
        <AvatarPreview config={config} skin={config.skin_tone || skinTones[0]} />

        {/* Controls */}
        <div className="flex-1 space-y-6">
          {/* Skin Tone */}
          <div>
            <p id="avatar-skintone" className="block text-sm font-semibold text-kv-dark mb-2">Skin Tone</p>
            <div role="group" aria-labelledby="avatar-skintone" className="flex gap-3">
              {skinTones.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  aria-label={`Skin tone ${tone}`}
                  aria-pressed={config.skin_tone === tone}
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
            <p id="avatar-hairstyle" className="block text-sm font-semibold text-kv-dark mb-2">Hair Style</p>
            <div role="group" aria-labelledby="avatar-hairstyle" className="flex flex-wrap gap-2">
              {hairStyles.map((style) => (
                <button
                  key={style}
                  type="button"
                  aria-pressed={config.hair_style === style}
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
            <p id="avatar-haircolour" className="block text-sm font-semibold text-kv-dark mb-2">Hair Colour</p>
            <div role="group" aria-labelledby="avatar-haircolour" className="flex gap-3">
              {hairColours.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Hair colour ${color}`}
                  aria-pressed={config.hair_colour === color}
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
            <label htmlFor="avatar-face-shape" className="block text-sm font-semibold text-kv-dark mb-2">Face Shape</label>
            <select 
              id="avatar-face-shape"
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
