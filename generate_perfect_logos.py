import zlib, struct

def get_decoded(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()
    pos = 8
    idat = []
    while pos < len(data):
        length = struct.unpack('>I', data[pos:pos+4])[0]
        ctype = data[pos+4:pos+8]
        cdata = data[pos+8:pos+8+length]
        pos += 12 + length
        if ctype == b'IHDR':
            width, height = struct.unpack('>II', cdata[:8])
        elif ctype == b'IDAT':
            idat.append(cdata)
    raw = bytearray(zlib.decompress(b''.join(idat)))
    stride = 1 + width * 4
    decoded = bytearray(width * height * 4)
    for row in range(height):
        filter_type = raw[row * stride]
        line_offset = row * stride + 1
        out_offset = row * width * 4
        prev_row = (row - 1) * width * 4
        for col in range(width * 4):
            x = raw[line_offset + col]
            a = decoded[out_offset + col - 4] if col >= 4 else 0
            b = decoded[prev_row + col] if row > 0 else 0
            c = decoded[prev_row + col - 4] if (row > 0 and col >= 4) else 0
            if filter_type == 0: v = x
            elif filter_type == 1: v = (x + a) & 0xff
            elif filter_type == 2: v = (x + b) & 0xff
            elif filter_type == 3: v = (x + ((a + b) >> 1)) & 0xff
            elif filter_type == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                v = (x + pr) & 0xff
            decoded[out_offset + col] = v
    return width, height, decoded

def write_png(filepath, width, height, rgba_data):
    raw_lines = bytearray()
    stride = width * 4
    for y in range(height):
        raw_lines.append(0)
        raw_lines.extend(rgba_data[y * stride : (y + 1) * stride])
    compressed = zlib.compress(bytes(raw_lines), 9)
    def make_chunk(chunk_type, data):
        crc = zlib.crc32(chunk_type + data) & 0xffffffff
        return struct.pack('>I', len(data)) + chunk_type + data + struct.pack('>I', crc)
    ihdr = struct.pack('>II', width, height) + b'\x08\x06\x00\x00\x00'
    png = b'\x89PNG\r\n\x1a\n' + make_chunk(b'IHDR', ihdr) + make_chunk(b'IDAT', compressed) + make_chunk(b'IEND', b'')
    with open(filepath, 'wb') as f:
        f.write(png)
    print(f"Wrote {filepath} ({width}x{height})")

def unmultiply_white(r, g, b):
    dr = 255 - r
    dg = 255 - g
    db = 255 - b
    max_d = max(dr, dg, db)
    if max_d <= 2:
        return 0, 0, 0, 0
    alpha = min(255, int(max_d * 1.05))
    orig_r = max(0, min(255, int(round(255 - (dr * 255.0 / alpha)))))
    orig_g = max(0, min(255, int(round(255 - (dg * 255.0 / alpha)))))
    orig_b = max(0, min(255, int(round(255 - (db * 255.0 / alpha)))))
    return orig_r, orig_g, orig_b, alpha

# Load original light image
src_light = 'C:/Users/gowth/.gemini/antigravity-ide/brain/603d6c1a-8742-46e0-b57f-b069f777c626/.user_uploaded/media_1791782209128.png'
orig_w, orig_h, orig_dec = get_decoded(src_light)

# Bounding boxes in original light image:
p_x0, p_y0, p_x1, p_y1 = 196, 106, 449, 262
p_w = p_x1 - p_x0 + 1
p_h = p_y1 - p_y0 + 1

pills_light_rgba = bytearray(p_w * p_h * 4)
pills_dark_rgba = bytearray(p_w * p_h * 4)

for py in range(p_h):
    for px in range(p_w):
        src_idx = ((p_y0 + py) * orig_w + (p_x0 + px)) * 4
        r, g, b = orig_dec[src_idx:src_idx+3]
        ur, ug, ub, ua = unmultiply_white(r, g, b)
        dst_idx = (py * p_w + px) * 4
        pills_light_rgba[dst_idx:dst_idx+4] = bytes([ur, ug, ub, ua])
        
        # Dark pills: boost right pill glow for dark backgrounds
        if ua > 0:
            boost_a = min(255, int(ua * 1.35))
            boost_r = min(255, int(ur * 1.1))
            boost_g = min(255, int(ug * 0.9))
            boost_b = min(255, int(ub * 1.05))
            pills_dark_rgba[dst_idx:dst_idx+4] = bytes([boost_r, boost_g, boost_b, boost_a])
        else:
            pills_dark_rgba[dst_idx:dst_idx+4] = bytes([0, 0, 0, 0])

# Text layer (Ricoz + Analytics)
t_x0, t_y0, t_x1, t_y1 = 170, 272, 487, 408
t_w = t_x1 - t_x0 + 1
t_h = t_y1 - t_y0 + 1

text_light_rgba = bytearray(t_w * t_h * 4)
text_dark_rgba = bytearray(t_w * t_h * 4)

for ty in range(t_h):
    orig_y = t_y0 + ty
    for tx in range(t_w):
        orig_x = t_x0 + tx
        src_idx = (orig_y * orig_w + orig_x) * 4
        r, g, b = orig_dec[src_idx:src_idx+3]
        ur, ug, ub, ua = unmultiply_white(r, g, b)
        dst_idx = (ty * t_w + tx) * 4
        
        # Light text: Ricoz black (#0f172a), Analytics pink (#e6245a)
        text_light_rgba[dst_idx:dst_idx+4] = bytes([ur, ug, ub, ua])
        
        # Dark text: Ricoz white (#ffffff), Analytics vibrant neon pink (#ff3366)
        if ua > 0:
            if orig_y < 370:
                text_dark_rgba[dst_idx:dst_idx+4] = bytes([255, 255, 255, ua])
            else:
                text_dark_rgba[dst_idx:dst_idx+4] = bytes([255, 51, 102, ua])
        else:
            text_dark_rgba[dst_idx:dst_idx+4] = bytes([0, 0, 0, 0])

# ==========================================
# 1. HORIZONTAL LOGOS (LIGHT & DARK)
# ==========================================
gap = 28
pad_x = 10
pad_y = 8
h_width = p_w + gap + t_w + pad_x * 2
h_height = max(p_h, t_h) + pad_y * 2

p_dest_x = pad_x
p_dest_y = pad_y + (h_height - pad_y * 2 - p_h) // 2

t_dest_x = pad_x + p_w + gap
t_dest_y = pad_y + (h_height - pad_y * 2 - t_h) // 2

def compose_horizontal(pills_layer, text_layer):
    canvas = bytearray(h_width * h_height * 4)
    # Blit pills
    for py in range(p_h):
        for px in range(p_w):
            s_idx = (py * p_w + px) * 4
            d_idx = ((p_dest_y + py) * h_width + (p_dest_x + px)) * 4
            canvas[d_idx:d_idx+4] = pills_layer[s_idx:s_idx+4]
    # Blit text
    for ty in range(t_h):
        for tx in range(t_w):
            s_idx = (ty * t_w + tx) * 4
            d_idx = ((t_dest_y + ty) * h_width + (t_dest_x + tx)) * 4
            canvas[d_idx:d_idx+4] = text_layer[s_idx:s_idx+4]
    return canvas

horiz_light = compose_horizontal(pills_light_rgba, text_light_rgba)
horiz_dark = compose_horizontal(pills_dark_rgba, text_dark_rgba)

write_png('client/public/ricoz-logo-light-horizontal.png', h_width, h_height, horiz_light)
write_png('client/public/ricoz-logo-dark-horizontal.png', h_width, h_height, horiz_dark)

# ==========================================
# 2. STACKED LOGOS (LIGHT & DARK)
# ==========================================
s_pad_x = 24
s_pad_y = 18
s_gap = 14
s_width = max(p_w, t_w) + s_pad_x * 2
s_height = p_h + s_gap + t_h + s_pad_y * 2

s_p_dest_x = (s_width - p_w) // 2
s_p_dest_y = s_pad_y

s_t_dest_x = (s_width - t_w) // 2
s_t_dest_y = s_pad_y + p_h + s_gap

def compose_stacked(pills_layer, text_layer):
    canvas = bytearray(s_width * s_height * 4)
    for py in range(p_h):
        for px in range(p_w):
            s_idx = (py * p_w + px) * 4
            d_idx = ((s_p_dest_y + py) * s_width + (s_p_dest_x + px)) * 4
            canvas[d_idx:d_idx+4] = pills_layer[s_idx:s_idx+4]
    for ty in range(t_h):
        for tx in range(t_w):
            s_idx = (ty * t_w + tx) * 4
            d_idx = ((s_t_dest_y + ty) * s_width + (s_t_dest_x + tx)) * 4
            canvas[d_idx:d_idx+4] = text_layer[s_idx:s_idx+4]
    return canvas

stacked_light = compose_stacked(pills_light_rgba, text_light_rgba)
stacked_dark = compose_stacked(pills_dark_rgba, text_dark_rgba)

write_png('client/public/ricoz-logo-light.png', s_width, s_height, stacked_light)
write_png('client/public/ricoz-logo-dark.png', s_width, s_height, stacked_dark)
write_png('client/public/ricoz-logo.png', s_width, s_height, stacked_light)

# ==========================================
# 3. FAVICONS (64x64 transparent icons)
# ==========================================
fav_size = 64
fav_light_rgba = bytearray(fav_size * fav_size * 4)
fav_dark_rgba = bytearray(fav_size * fav_size * 4)
fav_scale = 56.0 / max(p_w, p_h)
fav_w = int(p_w * fav_scale)
fav_h = int(p_h * fav_scale)
fav_ox = (fav_size - fav_w) // 2
fav_oy = (fav_size - fav_h) // 2

for dy in range(fav_h):
    sy = int(dy / fav_scale)
    if sy >= p_h: sy = p_h - 1
    for dx in range(fav_w):
        sx = int(dx / fav_scale)
        if sx >= p_w: sx = p_w - 1
        s_idx = (sy * p_w + sx) * 4
        d_idx = ((fav_oy + dy) * fav_size + (fav_ox + dx)) * 4
        fav_light_rgba[d_idx:d_idx+4] = pills_light_rgba[s_idx:s_idx+4]
        fav_dark_rgba[d_idx:d_idx+4] = pills_dark_rgba[s_idx:s_idx+4]

write_png('client/public/favicon-light.png', fav_size, fav_size, fav_light_rgba)
write_png('client/public/favicon-dark.png', fav_size, fav_size, fav_dark_rgba)
write_png('client/public/favicon.png', fav_size, fav_size, fav_light_rgba)

print("Generated all transparent pixel-perfect logos!")
