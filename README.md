# TimeR

TimeR is a tiny Python project that encrypts a minute-level time range
as a reversible four-letter code with a shared key.

Required example:

```bash
python3 -m timer_cipher encrypt --key dog --start 19:26 --end 19:30
# absd

python3 -m timer_cipher decrypt --key dog --code absd
# 19:26-19:30
```

## Install

```bash
cd /home/swl/TimeR
python3 -m pip install -e .
```

After installation, use the `timer` command:

```bash
timer encrypt --key dog --start 19:26 --end 19:30
timer decrypt --key dog --code absd
```

## Python API

```python
from timer_cipher import decrypt_code, encrypt_interval

code = encrypt_interval("19:26", "19:30", "dog")
print(code)  # absd

time_range = decrypt_code("absd", "dog")
print(time_range)  # 19:26-19:30
```

## Design

TimeR maps `HH:MM-HH:MM` to two minute values in `[0, 1439]`, ranks
that ordered pair, and applies a reversible key-derived permutation over
the four-letter code space.

The alphabet is `a-zA-Z`, giving `52^4 = 7,311,616` possible codes.
Four lowercase-only letters would provide only `26^4 = 456,976` codes,
which is not enough for every possible `HH:MM-HH:MM` ordered pair
(`1440 * 1440 = 2,073,600`).

This is a compact reversible keyed encoding for demos and lightweight
obfuscation. For high-security encryption, use a longer authenticated
ciphertext format such as AES-GCM or Fernet.

## Test

```bash
python3 -m unittest
```

## Publish to GitHub

Create an empty GitHub repository named `TimeR`, then run:

```bash
cd /home/swl/TimeR
git remote add origin https://github.com/<your-username>/TimeR.git
git push -u origin main
```
