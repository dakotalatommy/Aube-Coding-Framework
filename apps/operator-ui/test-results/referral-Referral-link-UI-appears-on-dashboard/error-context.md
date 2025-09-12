# Page snapshot

```yaml
- link "Skip to content":
  - /url: "#main"
- main:
  - heading "Sign in" [level=1]
  - paragraph: Welcome back.
  - status:
    - text: Email
    - textbox "you@example.com"
    - text: Password
    - textbox "••••••••"
    - button "Sign in"
  - paragraph:
    - text: No account?
    - link "Create one":
      - /url: /signup
  - button "Continue with Google"
- region "Notifications (F8)":
  - list
```