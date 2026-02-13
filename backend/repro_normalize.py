
def normalize_value(val):
    """Normalize values for signature: handled str, float, int, None."""
    if val is None or str(val).strip() == "":
        return ""
    
    s_val = str(val).strip()
    
    try:
        f_val = float(s_val)
        # Check if it's effectively an integer
        if f_val.is_integer():
            return str(int(f_val))
        
        # If it's a float, round to 6 decimal places to mask precision errors
        # Format as fixed point string to avoid scientific notation
        # Then strip trailing zeros and decimal point if it becomes integer-like
        formatted = f"{f_val:.6f}".rstrip('0').rstrip('.')
        return formatted
    except ValueError:
        pass
        
    return s_val

v1 = -0.00964499999999998
v2 = -0.009645

n1 = normalize_value(v1)
n2 = normalize_value(v2)

print(f"Value 1: {v1} -> Normalized: '{n1}'")
print(f"Value 2: {v2} -> Normalized: '{n2}'")
print(f"Match: {n1 == n2}")

v3 = 50.157
v4 = 50.15700000000000000001
n3 = normalize_value(v3)
n4 = normalize_value(v4)
print(f"Value 3: {v3} -> Normalized: '{n3}'")
print(f"Value 4: {v4} -> Normalized: '{n4}'")
print(f"Match: {n3 == n4}")
