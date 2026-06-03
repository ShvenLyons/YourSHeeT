# TimeR

TimeR is a tiny Python and HTML project that encrypts a minute-level
time range as a reversible four-letter code with a shared key.

Required example:

```bash
python3 -m timer_cipher encrypt --key dog --start 19:26 --end 19:30
# absd

python3 -m timer_cipher decrypt --key dog --code absd
# 19:26-19:30
```

You can also omit `--end` when there is no follow-up:

```bash
python3 -m timer_cipher encrypt --key dog --start 19:26
# gcXj

python3 -m timer_cipher decrypt --key dog --code gcXj
# 19:26-N/A
```

## HTML Page

Open `index.html` directly in a browser, or publish it with GitHub Pages.
The page supports:

- entering `begin` and `end` to compute ciphertext automatically
- leaving `end` blank or checking `N/A`
- entering ciphertext to recover `begin` and `end`

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

TimeR maps `HH:MM-HH:MM` or `HH:MM-N/A` to a unique integer:

```text
rank = beginMinute * 1441 + endBucket
endBucket = 0..1439 for HH:MM, or 1440 for N/A
```

It then applies a reversible key-derived affine permutation over the
four-letter code space:

```text
cipherValue = (multiplier * rank + offset) mod 52^4
```

`multiplier` is always chosen so that it has a modular inverse. Because
every plaintext range has a unique `rank`, and the cipher transform is a
bijection over the code space, there is no collision:

```text
M(T1-T2) != M(T3-T4) when T1-T2 != T3-T4
```

The alphabet is `a-zA-Z`, giving `52^4 = 7,311,616` possible codes.
TimeR needs `1440 * 1441 = 2,075,040` codes after adding `N/A`. Four
lowercase-only letters would provide only `26^4 = 456,976` codes, which
is not enough.

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

In the GitHub repository, enable Pages from the `main` branch and root
folder. The interactive page will be served from:

```text
https://<your-username>.github.io/TimeR/
```
