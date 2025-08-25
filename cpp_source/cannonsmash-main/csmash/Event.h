/**
 * @file
 * @brief Definition of Event class.
 * @author KANNA Yoshihiro
 * @version $Id$
 */

// Copyright (C) 2000-2003, 2007  神南 吉宏(Kanna Yoshihiro)
//
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 2 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA

#ifndef _Event_
#define _Event_

#include "Ball.h"
#include "Player.h"

/**
 * Data structure to hold backtrack information.
 * Backtrack is stored into backtrack buffer for each TICK.
 * On network play, if backtrack is necessary, backtrack buffer is referred
 * to rollback.
 */
struct Backtrack {
  long sec;		///< Second of which this backtrack information is recorded.
  char count;		///< TICK count in the second speficied at sec.
  Ball theBall;		///< Copy of theBall object of the TICK.
  Player thePlayer;	///< Copy of thePlayer object of the TICK.
  Player comPlayer;	///< Copy of comPlayer object of the TICK.
  long score1;		///< Score of thePlayer side of the TICK.
  long score2;		///< Score of comPlayer side of the TICK.
  vector3d camera;	///< Camera position of the TICK.
  vector3d target;	///< Camera view target of the TICK.
};

class ExternalData;

/**
 * Event handler class.
 * This class handles user event, network event and timer event.
 * Handling the event, this class changes the game status and notify the
 * change to some classes.
 */
class Event {
public:
  ~Event();

  static Event* TheEvent();

  bool Init();

  static void IdleFunc();
  static void KeyboardFunc( SDL_Event key, int x, int y );
  static void KeyUpFunc( SDL_Event key, int x, int y );
  static void MotionFunc( int x, int y );
  static void ButtonFunc( int button, int state, int x, int y );

  bool BackTrack( long Histptr );

  static struct timeb m_lastTime;	///< Time when IdleFunc is called previously.

  long m_mouseButton;			///< Mouse button status holder. This is for skip replay.

#ifdef LOGGING
  static void GetAdjustedTime( long &sec, long &cnt );
  void RemainingLog();
  void logRecord();
#endif

  /**
   * Check whether backtracking is enabled or not.
   * @return returns true if backtracking is enabled.
   */
  bool IsBackTracking() { return m_backtrack; };

  bool GetExternalData( ExternalData *&ext, long side );
  bool GetExternalData( long side );

  struct Backtrack *GetBackTrack(long histPtr);
protected:
  bool Move();
  bool IsModeChanged( long preMode );
  void Record();
  void ReadData();
  void ReadSelectData();

  static void ClearBacktrack();

  SDL_keysym m_KeyHistory[MAX_HISTORY];		///< History of key input
  long m_MouseXHistory[MAX_HISTORY];		///< History of mouse move
  long m_MouseYHistory[MAX_HISTORY];		///< History of mouse move
  unsigned long m_MouseBHistory[MAX_HISTORY];	///< History of mouse button
  int  m_Histptr;				///< Current point of the history buffers

  /**
   * List of opponent action data.
   * This is used on network play only.
   */
  ExternalData *m_External;
  /**
   * Array of Backtrack data.
   */
  struct Backtrack m_BacktrackBuffer[MAX_HISTORY];
  bool m_backtrack;				///< backtracking is enabled or not.

  void SetNextMousePointer( long &x, long &y );
private:
  Event();
  static Event* m_theEvent;			///< Pointer to the singleton Event object.
};

#endif	// _Event_
