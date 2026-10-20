# FRC 5090 Programming Guides

Programming guides for **FRC Team 5090, the Trenton TorqueNados**. They cover what a programmer on our team should
know, from setting up a laptop and flashing the radio to PID tuning, every kind of mechanism we build, sensors,
Limelight vision, PathPlanner autos and debugging. Every guide points at real code from our past robots so students
can see how we actually did it.

The team uses the **CTRE ecosystem** (Phoenix 6, Kraken X60/X44, Talon FX/FXS, CANcoder, Pigeon 2, CANivore, Phoenix
Pro), **WPILib command-based Java**, **Limelight** and **PathPlanner**.

**Printable version:** the guides are written to be printed and put in a binder. The PDFs (full binder, one PDF per
part, and one per guide) are attached to the latest [release](../../releases/latest).

## Start here

Read [`guides/README.md`](guides/README.md) first. It has the learning path, an "I need to..." index and an explanation
of how to find our code from a guide.

| Part | Guides |
|---|---|
| **1. Getting started** | [23 Setting up laptops](guides/23-setting-up-a-programming-laptop.md) · [24 Using our robot template](guides/24-using-our-robot-template.md) · [25 How to research](guides/25-how-to-research.md) · [22 Git, GitHub and code standards](guides/22-git-and-code-standards.md) |
| **2. Robot basics** | [01 Radio and robot network](guides/01-radio-and-robot-network.md) · [02 Phoenix Tuner X and CAN](guides/02-phoenix-tuner-x-and-can.md) · [03 Driver Station and match checklist](guides/03-driver-station-and-match-checklist.md) · [30 Sensor and device catalog](guides/30-sensor-and-device-catalog.md) |
| **3. Writing code** | [04 Command-based programming](guides/04-command-based-basics.md) · [05 Motors in Phoenix 6](guides/05-motors-in-phoenix-6.md) · [06 Current limits and brownouts](guides/06-current-limits-and-brownouts.md) · [31 Phoenix Pro: FOC and the paid features](guides/31-phoenix-pro-features.md) |
| **4. Control** | [07 What is PID](guides/07-what-is-pid.md) · [08 Tuning PID step by step](guides/08-tuning-pid-step-by-step.md) · [09 Motion Magic and position control](guides/09-motion-magic-and-position-control.md) |
| **5. Mechanisms** | [10 Flywheels and shooters](guides/10-flywheels-and-shooters.md) · [11 Intakes and rollers](guides/11-intakes-and-rollers.md) · [12 Spring-back and auto-retract](guides/12-spring-back-and-auto-retract.md) · [13 Turrets](guides/13-turrets.md) · [14 Arms (single and double-jointed)](guides/14-arms-single-and-double-jointed.md) · [15 Elevators](guides/15-elevators.md) · [26 State machines for pick-and-place](guides/26-state-machines-for-pick-and-place.md) |
| **6. Sensors and encoders** | [21 Sensors and homing](guides/21-sensors-and-homing.md) · [27 Relative vs absolute encoders](guides/27-relative-vs-absolute-encoders.md) · [28 Fusing sensors to a motor](guides/28-fusing-sensors-to-a-motor.md) · [29 The Chinese Remainder Theorem for turrets](guides/29-chinese-remainder-theorem-turrets.md) |
| **7. Driving, vision and autos** | [16 Swerve drive with the CTRE generator](guides/16-swerve-drive-ctre.md) · [17 Limelight and vision](guides/17-limelight-and-vision.md) · [32 Limelight object detection](guides/32-limelight-object-detection.md) · [33 Calibrating Limelights at events](guides/33-limelight-field-calibration-at-events.md) · [18 PathPlanner autos](guides/18-pathplanner-autos.md) |
| **8. Finding problems** | [19 Logging and debugging](guides/19-logging-and-debugging.md) · [20 Simulation and testing](guides/20-simulation-and-testing.md) · [34 AdvantageKit and AdvantageScope](guides/34-advantagekit-and-advantagescope.md) |

## Our code these guides point to

| Repo | What it is |
|---|---|
| [TorqueNados-FRC5090/Hephaestus](https://github.com/TorqueNados-FRC5090/Hephaestus) | 2026 robot (rebuilt as Theseus) |
| [TorqueNados-FRC5090/Robot-Template](https://github.com/TorqueNados-FRC5090/Robot-Template) | Our starting point for a new robot |
| [HALFxAxHEART/frc-auto-align](https://github.com/HALFxAxHEART/frc-auto-align) | Teaching repo: drive to a scoring spot at the push of a button |
| [TorqueNados-FRC5090/Stingray-2025](https://github.com/TorqueNados-FRC5090/Stingray-2025) | 2025 robot |
| [TorqueNados-FRC5090/Thunderstrike-2024](https://github.com/TorqueNados-FRC5090/Thunderstrike-2024) | 2024 robot |
| [TorqueNados-FRC5090/Petrichor-2023](https://github.com/TorqueNados-FRC5090/Petrichor-2023) | 2023 robot |

Code links in the guides are pinned to a specific commit, so they keep pointing at the same lines even after those
repos change.

## Notes

- Written for the **2026 software** (WPILib 2026, Phoenix 6 v26, PathPlanner 2026, Limelight OS 2026). In 2027 the
  SystemCore controller replaces the roboRIO; where something here disagrees with the current official docs, trust
  the docs.
- Example code in the guides is teaching code. Most of it has not run on a real robot, and every gain is a starting
  value to tune.
- Product photos belong to their makers (CTR Electronics, WestCoast Products, Redux Robotics, REV Robotics, Limelight
  Vision) and are credited in each caption. Screenshots are credited to their sources.
- Other teams are welcome to read and learn from these guides.

## Building the printable PDFs

```bash
cd tools && bun install          # needs Bun and Python 3 with PyMuPDF (pip install pymupdf)
./build-print.sh                 # writes print/ (full binder, Parts/, Individual guides/)
python3 checklinks.py ../guides  # checks every pinned code link (needs the repos cloned in /tmp, see the script)
```

`render-print.ts` turns the Markdown into pages (logo, team blue `#000AB5` and gold `#FFA700`, code references
printed as "repo · file · lines", web links as numbered notes). `assemble.py` adds the header, footer and edge tabs and
builds the binder so every guide starts on a right-hand page for double-sided printing.
