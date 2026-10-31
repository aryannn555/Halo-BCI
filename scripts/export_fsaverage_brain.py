import json
from pathlib import Path
import numpy as np
import mne

def compute_normals(vertices, faces):
    """Computes per-vertex smoothed surface normals."""
    normals = np.zeros_like(vertices)
    v0 = vertices[faces[:, 0]]
    v1 = vertices[faces[:, 1]]
    v2 = vertices[faces[:, 2]]
    face_normals = np.cross(v1 - v0, v2 - v0)
    
    # Accumulate face normals into vertices
    for i in range(3):
        np.add.at(normals, faces[:, i], face_normals)
        
    lens = np.linalg.norm(normals, axis=1, keepdims=True)
    lens[lens == 0] = 1.0
    return normals / lens

def main():
    p = Path.home() / 'mne_data/MNE-fsaverage-data/fsaverage/bem/fsaverage-ico-5-src.fif'
    if not p.exists():
        print(f"Error: {p} not found")
        return

    print("Reading FreeSurfer fsaverage cortical surfaces...")
    src = mne.read_source_spaces(str(p))

    lh = src[0]
    rh = src[1]

    lh_verts_raw = lh['rr'][lh['vertno']]
    lh_tris = lh['use_tris']

    rh_verts_raw = rh['rr'][rh['vertno']]
    rh_tris = rh['use_tris']

    # Combine to calculate global center and scaling
    all_verts = np.vstack([lh_verts_raw, rh_verts_raw])
    center = np.mean(all_verts, axis=0)
    scale = 1.25 / np.max(np.abs(all_verts - center))

    def to_three(verts):
        c = (verts - center) * scale
        # FS: X=right, Y=anterior, Z=superior
        # Three.js: X=right, Y=superior, Z=anterior
        tx = c[:, 0]
        ty = c[:, 2] # superior -> Y
        tz = c[:, 1] # anterior -> Z
        return np.column_stack([tx, ty, tz]).round(4)

    lh_verts = to_three(lh_verts_raw)
    rh_verts = to_three(rh_verts_raw)

    print("Computing surface normals...")
    lh_normals = compute_normals(lh_verts, lh_tris).round(4)
    rh_normals = compute_normals(rh_verts, rh_tris).round(4)

    out_dir = Path("frontend/public/models")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "fsaverage_brain.json"

    data = {
        "lh": {
            "vertices": lh_verts.flatten().tolist(),
            "normals": lh_normals.flatten().tolist(),
            "faces": lh_tris.flatten().tolist(),
        },
        "rh": {
            "vertices": rh_verts.flatten().tolist(),
            "normals": rh_normals.flatten().tolist(),
            "faces": rh_tris.flatten().tolist(),
        }
    }

    print(f"Writing web-ready anatomical brain to {out_file}...")
    with open(out_file, "w") as f:
        json.dump(data, f)

    mb = out_file.stat().st_size / (1024 * 1024)
    print(f"Done! {out_file} is {mb:.2f} MB. Left vertices: {len(lh_verts)}, Right vertices: {len(rh_verts)}")

if __name__ == "__main__":
    main()
