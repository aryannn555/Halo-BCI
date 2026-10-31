import json
from pathlib import Path
import mne
import numpy as np

def main():
    fsaverage_dir = Path.home() / "mne_data" / "MNE-fsaverage-data" / "fsaverage"
    if not fsaverage_dir.exists():
        print(f"Waiting for {fsaverage_dir} to exist...")
        return False

    lh_pial = fsaverage_dir / "surf" / "lh.pial"
    rh_pial = fsaverage_dir / "surf" / "rh.pial"

    if not lh_pial.exists() or not rh_pial.exists():
        print("Surface files not found yet in fsaverage/surf/")
        return False

    print("Reading FreeSurfer anatomical pial surfaces...")
    rr_lh, tris_lh = mne.read_surface(str(lh_pial))
    rr_rh, tris_rh = mne.read_surface(str(rh_pial))

    print(f"Original Left hemisphere: {len(rr_lh)} vertices, {len(tris_lh)} faces")
    print(f"Original Right hemisphere: {len(rr_rh)} vertices, {len(tris_rh)} faces")

    # Decimate to ~7,500 faces per hemisphere for optimal 60fps WebGL rendering
    print("Decimating surface to WebGL-optimized resolution (7,500 faces/hemi)...")
    rr_lh_dec, tris_lh_dec = mne.decimate_surface(rr_lh, tris_lh, n_triangles=7500)
    rr_rh_dec, tris_rh_dec = mne.decimate_surface(rr_rh, tris_rh, n_triangles=7500)

    # Normalize coordinate frame: center at origin and scale to fit in [-1, +1]
    all_verts = np.vstack([rr_lh_dec, rr_rh_dec])
    center = np.mean(all_verts, axis=0)
    max_range = np.max(np.abs(all_verts - center))

    scale = 1.05 / max_range

    # Three.js coordinate convention:
    # FreeSurfer: X is right, Y is anterior, Z is superior
    # Three.js: X is right, Y is superior, Z is anterior
    def transform_coords(verts):
        centered = (verts - center) * scale
        x = centered[:, 0]
        y = centered[:, 2] # superior -> Y
        z = centered[:, 1] # anterior -> Z
        return np.column_stack([x, y, z]).round(4)

    verts_lh_3d = transform_coords(rr_lh_dec)
    verts_rh_3d = transform_coords(rr_rh_dec)

    out_dir = Path("frontend/public/models")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "brain_mesh.json"

    data = {
        "left": {
            "vertices": verts_lh_3d.flatten().tolist(),
            "indices": tris_lh_dec.flatten().tolist(),
        },
        "right": {
            "vertices": verts_rh_3d.flatten().tolist(),
            "indices": tris_rh_dec.flatten().tolist(),
        }
    }

    print(f"Writing web-optimized anatomical brain model to {out_file}...")
    with open(out_file, "w") as f:
        json.dump(data, f)

    file_size_mb = out_file.stat().st_size / (1024 * 1024)
    print(f"Success! {out_file} generated ({file_size_mb:.2f} MB).")
    return True

if __name__ == "__main__":
    main()
